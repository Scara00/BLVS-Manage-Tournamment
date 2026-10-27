"use server";

import type { SupabaseClient } from "@supabase/supabase-js";
import { refresh } from "next/cache";
import { isUuid } from "@/lib/api/validation";
import { getCurrentUser, type CurrentUser } from "@/lib/auth/session";
import type { Categoria } from "@/lib/db/types";
import { avviaFaseDemo, getDemoAvvioFase } from "@/lib/demo/avvio-fase";
import { publishPhaseStarted } from "@/lib/live/publish";
import { pubblicaTabellone } from "@/lib/tappe/live-admin/pubblica";
import { readSupabaseEnv } from "@/lib/supabase/env";
import { now } from "@/lib/time/server-time";
import { CATEGORIA_NOME, parseCategoriaSegmento } from "./paths";
import type { ProblemaAvvio } from "./regole";
import { problemiDaDettaglio } from "./errori";
import {
  AVVIO_MESSAGES,
  messaggioSuccesso,
  type AvvioFaseState,
} from "./state";

type PgError = {
  code?: string;
  hint?: string | null;
  details?: string | null;
  message?: string;
};

type Sessione =
  | { ok: true; supabase: SupabaseClient | null }
  | { ok: false; reason: "sessionExpired" | "permissionDenied" };

/** Admin role checked on the server; `avvia_fase` checks it again. */
async function sessioneAdmin(): Promise<Sessione> {
  if (!readSupabaseEnv()) return { ok: true, supabase: null };
  let user: CurrentUser | null;
  try {
    user = await getCurrentUser();
  } catch (error) {
    console.error("[avvio-fase] verifica della sessione non riuscita", error);
    user = null;
  }
  if (!user) return { ok: false, reason: "sessionExpired" };
  if (user.ruolo !== "admin") return { ok: false, reason: "permissionDenied" };
  return { ok: true, supabase: user.supabase };
}

type MotivoErrore = Extract<AvvioFaseState, { status: "error" }>["reason"];

type Esito =
  | { ok: true; partite: number; tappaNome: string }
  | { ok: false; reason: MotivoErrore; message: string }
  | { ok: false; errori: ProblemaAvvio[] };

function errore(reason: MotivoErrore, message: string): Esito {
  return { ok: false, reason, message };
}

function avviaDemo(tappaId: string, categoria: Categoria): Esito {
  const nome = getDemoAvvioFase(tappaId, categoria)?.tappa.nome ?? tappaId;
  const esito = avviaFaseDemo(tappaId, categoria);
  switch (esito.status) {
    case "ok":
      return { ok: true, partite: esito.partite, tappaNome: nome };
    case "bloccato":
      return { ok: false, errori: esito.errori };
    case "giaAvviata":
      return errore("conflict", AVVIO_MESSAGES.giaAvviata);
    default:
      return errore("conflict", AVVIO_MESSAGES.nonAvviabile);
  }
}

async function avviaDb(
  supabase: SupabaseClient,
  tappaId: string,
  categoria: Categoria,
): Promise<Esito> {
  if (!isUuid(tappaId)) return errore("conflict", AVVIO_MESSAGES.nonAvviabile);
  const { data: tappa, error: readError } = await supabase
    .from("tappe")
    .select("nome, tabelloni (id, categoria)")
    .eq("id", tappaId)
    .maybeSingle();
  if (readError) throw readError;
  const row = tappa as {
    nome: string;
    tabelloni: { id: string; categoria: Categoria }[];
  } | null;
  const tabellone = row?.tabelloni.find((t) => t.categoria === categoria);
  if (!row || !tabellone) {
    return errore("conflict", AVVIO_MESSAGES.nonAvviabile);
  }

  const { data, error } = await supabase.rpc("avvia_fase", {
    p_tabellone: tabellone.id,
  });
  if (error) return esitoErrore(error);
  return {
    ok: true,
    partite: (data as unknown[]).length,
    tappaNome: row.nome,
  };
}

function esitoErrore(error: PgError): Esito {
  if (error.code === "42501") {
    return errore("permissionDenied", AVVIO_MESSAGES.permissionDenied);
  }
  switch (error.hint) {
    case "avvio_bloccato":
      return { ok: false, errori: problemiDaDettaglio(error.details) };
    case "fase_gia_avviata":
      return errore("conflict", AVVIO_MESSAGES.giaAvviata);
    case "tappa_non_avviabile":
    case "tappa_archiviata":
    case "tappa_annullata":
      return errore("conflict", AVVIO_MESSAGES.nonAvviabile);
    case "partite_iniziate":
      return errore("conflict", AVVIO_MESSAGES.partiteIniziate);
  }
  if (error.code === "P0002") {
    return errore("conflict", AVVIO_MESSAGES.nonAvviabile);
  }
  console.error("[avvio-fase] avvio non riuscito", error);
  return errore("network", AVVIO_MESSAGES.network);
}

/**
 * Starts the «gironi iniziali» phase of one board: creates its matches,
 * moves the stage to «in corso» and tells the live pages.
 */
export async function avviaFase(
  _prev: AvvioFaseState,
  formData: FormData,
): Promise<AvvioFaseState> {
  const at = now().getTime();
  const sessione = await sessioneAdmin();
  if (!sessione.ok) {
    return {
      status: "error",
      reason: sessione.reason,
      message: AVVIO_MESSAGES[sessione.reason],
      at,
    };
  }

  const tappaId = String(formData.get("tappaId") ?? "");
  const categoria = parseCategoriaSegmento(
    String(formData.get("categoria") ?? ""),
  );
  if (!tappaId || !categoria) {
    return {
      status: "error",
      reason: "conflict",
      message: AVVIO_MESSAGES.nonAvviabile,
      at,
    };
  }

  let esito: Esito;
  try {
    esito = sessione.supabase
      ? await avviaDb(sessione.supabase, tappaId, categoria)
      : avviaDemo(tappaId, categoria);
  } catch (error) {
    console.error("[avvio-fase] avvio non riuscito", error);
    esito = errore("network", AVVIO_MESSAGES.network);
  }

  if (!esito.ok) {
    if ("errori" in esito) {
      refresh();
      return {
        status: "fieldErrors",
        errori: esito.errori,
        message: AVVIO_MESSAGES.bloccato,
        at,
      };
    }
    return {
      status: "error",
      reason: esito.reason,
      message: esito.message,
      at,
    };
  }

  publishPhaseStarted({
    id: `${tappaId}:${categoria}`,
    stageId: tappaId,
    label: `${esito.tappaNome}, ${CATEGORIA_NOME[categoria]}`,
    category: categoria,
    phase: "gironi_iniziali",
    matches: esito.partite,
  });
  await pubblicaTabellone(
    { supabase: sessione.supabase },
    tappaId,
    categoria,
    `iniziati i gironi, ${esito.partite === 1 ? "1 partita" : `${esito.partite} partite`} da giocare`,
  );
  refresh();
  return {
    status: "success",
    partite: esito.partite,
    message: messaggioSuccesso(categoria, esito.partite),
    at,
  };
}
