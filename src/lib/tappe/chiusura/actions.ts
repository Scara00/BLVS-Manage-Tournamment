"use server";

import type { SupabaseClient } from "@supabase/supabase-js";
import { refresh } from "next/cache";
import { getCurrentUser, type CurrentUser } from "@/lib/auth/session";
import type { Categoria } from "@/lib/db/types";
import {
  classificaTappaDemo,
  concludiTabelloneDemo,
} from "@/lib/demo/admin-live";
import { readSupabaseEnv } from "@/lib/supabase/env";
import { now } from "@/lib/time/server-time";
import {
  CATEGORIA_NOME,
  parseCategoriaSegmento,
} from "@/lib/tappe/avvio/paths";
import { leggiClassificaTappa } from "@/lib/tappe/classifica/dati";
import type { ClassificaTappa } from "@/lib/tappe/classifica/classifica";
import { leggiTabelloneLive } from "@/lib/tappe/live-admin/dati";
import { adminLivePath } from "@/lib/tappe/live-admin/paths";
import { pubblicaTabellone } from "@/lib/tappe/live-admin/pubblica";
import { CHIUSURA_MESSAGES, descriviBlocco, messaggioChiusura } from "./format";
import { pubblicaChiusura } from "./pubblica";
import { puntiDefinitivi } from "./punti";
import { bloccoChiusura, type BloccoChiusura } from "./regole";
import type { ConcludiTabelloneState } from "./state";

type Sessione =
  | { ok: true; supabase: SupabaseClient | null }
  | { ok: false; reason: "sessionExpired" | "permissionDenied" };

/** Admin role checked on the server; the RPC checks it again. */
async function sessioneAdmin(): Promise<Sessione> {
  if (!readSupabaseEnv()) return { ok: true, supabase: null };
  let user: CurrentUser | null;
  try {
    user = await getCurrentUser();
  } catch (error) {
    console.error("[chiusura] verifica della sessione non riuscita", error);
    user = null;
  }
  if (!user) return { ok: false, reason: "sessionExpired" };
  if (user.ruolo !== "admin") return { ok: false, reason: "permissionDenied" };
  return { ok: true, supabase: user.supabase };
}

type PgError = { code?: string; hint?: string | null; detail?: string | null };

/** The server's refusal (`concludi_tabellone`) as the same block. */
function bloccoDaErrore(error: PgError): BloccoChiusura | "archiviata" | null {
  switch (error.hint) {
    case "tabellone_concluso":
      return { motivo: "concluso" };
    case "fase_non_finali":
      return { motivo: "fase" };
    case "partite_non_concluse":
      return { motivo: "partite", daConcludere: Number(error.detail ?? 1) };
    case "tappa_non_in_corso":
      return { motivo: "tappa", stato: "conclusa" };
    case "tappa_archiviata":
      return "archiviata";
  }
  return null;
}

/**
 * «Concludi tabellone» from w-admin-live (BLVS-43): checks the matches and
 * the open ties, then `concludi_tabellone` closes the board, writes the
 * registro and, with both boards closed, concludes the stage. The points
 * become definitive and the event goes out on the live channel.
 */
export async function concludiTabellone(
  _prev: ConcludiTabelloneState,
  formData: FormData,
): Promise<ConcludiTabelloneState> {
  const at = now().getTime();
  const fail = (
    reason: Extract<ConcludiTabelloneState, { status: "error" }>["reason"],
    message: string,
    link?: { href: string; label: string },
  ): ConcludiTabelloneState => ({ status: "error", reason, message, link, at });

  const sessione = await sessioneAdmin();
  if (!sessione.ok) {
    return fail(sessione.reason, CHIUSURA_MESSAGES[sessione.reason]);
  }
  const tappaId = String(formData.get("tappaId") ?? "");
  const categoria = parseCategoriaSegmento(
    String(formData.get("categoria") ?? ""),
  );
  if (!tappaId || !categoria) {
    return fail("conflict", CHIUSURA_MESSAGES.conflict);
  }

  const bloccato = (blocco: BloccoChiusura) =>
    fail(
      "bloccato",
      descriviBlocco(blocco),
      blocco.motivo === "parita" && blocco.finali[0]
        ? {
            href: `${adminLivePath(tappaId, categoria)}#girone-live-${blocco.finali[0].gironeId}`,
            label: "Risolvi parità",
          }
        : undefined,
    );

  let classifica: ClassificaTappa | null;
  let tappaConclusa: boolean;
  try {
    if (!sessione.supabase) {
      const esito = concludiTabelloneDemo(tappaId, categoria, now());
      if (!esito.ok) {
        if ("blocco" in esito) return bloccato(esito.blocco);
        return esito.motivo === "tappaArchiviata"
          ? fail("conflict", CHIUSURA_MESSAGES.tappaArchiviata)
          : fail("conflict", CHIUSURA_MESSAGES.conflict);
      }
      classifica = classificaTappaDemo(tappaId, categoria);
      tappaConclusa = esito.tappaConclusa;
    } else {
      const esito = await concludiDb(sessione.supabase, tappaId, categoria);
      if (!esito.ok) {
        if (esito.blocco === "archiviata") {
          return fail("conflict", CHIUSURA_MESSAGES.tappaArchiviata);
        }
        if (esito.blocco) return bloccato(esito.blocco);
        return fail(esito.reason, CHIUSURA_MESSAGES[esito.reason]);
      }
      classifica = esito.classifica;
      tappaConclusa = esito.tappaConclusa;
    }
  } catch (error) {
    console.error("[chiusura] tabellone non concluso", error);
    return fail("network", CHIUSURA_MESSAGES.network);
  }

  await pubblicaTabellone(
    { supabase: sessione.supabase },
    tappaId,
    categoria,
    "tabellone concluso",
  );
  await pubblicaChiusura(
    { supabase: sessione.supabase },
    { tappaId, categoria, tappaConclusa, classifica },
  );
  refresh();
  return {
    status: "success",
    message: messaggioChiusura(
      CATEGORIA_NOME[categoria].toLowerCase(),
      tappaConclusa,
    ),
    tappaConclusa,
    at,
  };
}

type EsitoDb =
  | { ok: true; classifica: ClassificaTappa | null; tappaConclusa: boolean }
  | {
      ok: false;
      blocco: BloccoChiusura | "archiviata" | null;
      reason: "conflict" | "permissionDenied";
    };

async function concludiDb(
  supabase: SupabaseClient,
  tappaId: string,
  categoria: Categoria,
): Promise<EsitoDb> {
  const adesso = now();
  const [tabellone, classifica] = await Promise.all([
    leggiTabelloneLive(supabase, tappaId, categoria, adesso),
    leggiClassificaTappa(supabase, tappaId, categoria),
  ]);
  if (!tabellone) return { ok: false, blocco: null, reason: "conflict" };
  // The open ties are known only here; the RPC checks the rest again.
  const blocco = bloccoChiusura({
    statoTappa: tabellone.tappa.stato,
    faseGioco: tabellone.faseGioco,
    conclusoIl: tabellone.conclusoIl,
    partite: tabellone.partite,
    classifica,
  });
  if (blocco) return { ok: false, blocco, reason: "conflict" };

  const definitiva = classifica
    ? { ...classifica, puntiProvvisori: false }
    : null;
  const { data, error } = await supabase.rpc("concludi_tabellone", {
    p_tabellone: tabellone.tabelloneId,
    p_punti: puntiDefinitivi(definitiva),
  });
  if (error) {
    if (error.code === "42501") {
      return { ok: false, blocco: null, reason: "permissionDenied" };
    }
    const daErrore = bloccoDaErrore(error);
    if (daErrore) return { ok: false, blocco: daErrore, reason: "conflict" };
    throw error;
  }
  const row = (data as { tappa_conclusa: boolean }[])[0];
  return {
    ok: true,
    classifica: await leggiClassificaTappa(supabase, tappaId, categoria),
    tappaConclusa: row?.tappa_conclusa === true,
  };
}
