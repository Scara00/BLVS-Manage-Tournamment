"use server";

import type { SupabaseClient } from "@supabase/supabase-js";
import { refresh } from "next/cache";
import { isUuid } from "@/lib/api/validation";
import { getCurrentUser, type CurrentUser } from "@/lib/auth/session";
import type { Categoria } from "@/lib/db/types";
import { classificaDemo, getDemoPunteggi } from "@/lib/demo/punteggi";
import { registraRitiroDemo } from "@/lib/demo/ritiri";
import { leggiClassificaGirone } from "@/lib/gironi/classifica";
import {
  publishGroupStandings,
  publishPendingScores,
  publishScore,
} from "@/lib/live/publish";
import {
  erroreConferma,
  messaggioImpattoCambiato,
  toImpattoFase,
  type PartitaSuccessivaRow,
} from "@/lib/punteggi/correzione/format";
import {
  SCELTE_IMPATTO,
  type ImpattoFase,
  type SceltaImpatto,
} from "@/lib/punteggi/correzione/types";
import { leggiPunteggi } from "@/lib/punteggi/dati";
import {
  contaDaInserire,
  nomiGiocatori,
  toGroupStandings,
  toLiveMatch,
} from "@/lib/punteggi/format";
import { readSupabaseEnv } from "@/lib/supabase/env";
import { parseCategoriaSegmento } from "@/lib/tappe/avvio/paths";
import { pubblicaTabellone } from "@/lib/tappe/live-admin/pubblica";
import { esitoRitiro, RITIRO_MESSAGES } from "./format";
import { leggiNoteAssenze } from "./read";
import type { ErroriRitiro, MotivoErroreRitiro, RitiroState } from "./types";
import { validaRitiro, type DatiRitiro } from "./validazione";

type PgError = {
  code?: string;
  hint?: string | null;
  detail?: string | null;
  message?: string;
};

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
    console.error("[ritiri] verifica della sessione non riuscita", error);
    user = null;
  }
  if (!user) return { ok: false, reason: "sessionExpired" };
  if (user.ruolo !== "admin") return { ok: false, reason: "permissionDenied" };
  return { ok: true, supabase: user.supabase };
}

type OpzioniImpatto = {
  scelta: SceltaImpatto | null;
  conferma: boolean;
  attesi: number | null;
};

type Esito =
  | {
      ok: true;
      nome: string | null;
      partite: number;
      scelta: SceltaImpatto | null;
      punteggiPersi: number;
    }
  | { ok: false; errori: ErroriRitiro }
  | { ok: false; reason: MotivoErroreRitiro }
  | {
      ok: false;
      impatto: ImpattoFase | null;
      motivo: "richiesto" | "conferma" | "cambiato";
    };

const MOTIVI_IMPATTO: Record<string, "richiesto" | "conferma" | "cambiato"> = {
  impatto_richiesto: "richiesto",
  conferma_richiesta: "conferma",
  punteggi_cambiati: "cambiato",
};

/** The next phase the withdrawal would affect, without its own matches. */
async function leggiImpatto(
  supabase: SupabaseClient,
  dati: DatiRitiro,
): Promise<ImpattoFase | null> {
  try {
    const { data, error } = await supabase.rpc("fase_successiva_correzione", {
      p_partita: dati.partite[0].partitaId,
    });
    if (error) throw error;
    const scelte = new Set(dati.partite.map((p) => p.partitaId));
    return toImpattoFase(
      ((data ?? []) as PartitaSuccessivaRow[]).filter(
        (r) => !scelte.has(r.partita_id),
      ),
    );
  } catch (error) {
    console.error("[ritiri] lettura della fase successiva non riuscita", error);
    return null;
  }
}

function erroreDb(error: PgError): Esito | null {
  if (error.code === "42501") return { ok: false, reason: "permissionDenied" };
  if (error.code === "P0002") {
    return {
      ok: false,
      errori: { giocatore: RITIRO_MESSAGES.partitaNonValida },
    };
  }
  switch (error.hint) {
    case "tipo_non_valido":
      return { ok: false, errori: { tipo: RITIRO_MESSAGES.tipoMancante } };
    case "partite_mancanti":
      return {
        ok: false,
        errori: { partite: RITIRO_MESSAGES.partiteMancanti },
      };
    case "partita_estranea":
    case "partita_annullata":
      return {
        ok: false,
        errori: { partite: RITIRO_MESSAGES.partitaNonValida },
      };
    case "gia_registrata":
      return { ok: false, errori: { partite: RITIRO_MESSAGES.giaRegistrata } };
    case "punteggio_cambiato":
      return { ok: false, reason: "conflict" };
    case "tappa_non_in_corso":
    case "tappa_archiviata":
      return { ok: false, reason: "nonRegistrabile" };
  }
  return null;
}

async function registraDb(
  supabase: SupabaseClient,
  dati: DatiRitiro,
  opzioni: OpzioniImpatto,
): Promise<Esito> {
  if (!isUuid(dati.iscrizioneId)) {
    return {
      ok: false,
      errori: { giocatore: RITIRO_MESSAGES.partitaNonValida },
    };
  }
  if (dati.partite.some((p) => !isUuid(p.partitaId))) {
    return { ok: false, errori: { partite: RITIRO_MESSAGES.partitaNonValida } };
  }
  const { data, error } = await supabase.rpc("registra_ritiro_assenza", {
    p_iscrizione: dati.iscrizioneId,
    p_tipo: dati.tipo,
    p_partite: dati.partite.map((p) => ({
      partita_id: p.partitaId,
      versione: p.versione,
    })),
    p_scelta: opzioni.scelta,
    p_conferma: opzioni.conferma,
    p_attesi: opzioni.attesi,
  });
  if (error) {
    const motivo = error.hint ? MOTIVI_IMPATTO[error.hint] : undefined;
    if (motivo) {
      return { ok: false, motivo, impatto: await leggiImpatto(supabase, dati) };
    }
    const noto = erroreDb(error);
    if (noto) return noto;
    throw error;
  }
  const row = (
    data as { partite: number; scelta: string | null; punteggi_persi: number }[]
  )[0];
  return {
    ok: true,
    nome: null,
    partite: Number(row.partite),
    scelta: SCELTE_IMPATTO.find((s) => s === row.scelta) ?? null,
    punteggiPersi: Number(row.punteggi_persi ?? 0),
  };
}

function registraDemo(
  tappaId: string,
  categoria: Categoria,
  dati: DatiRitiro,
  opzioni: OpzioniImpatto,
): Esito {
  const esito = registraRitiroDemo(tappaId, categoria, dati, opzioni);
  switch (esito.status) {
    case "ok":
      return {
        ok: true,
        nome: esito.nome,
        partite: esito.partite,
        scelta: esito.scelta,
        punteggiPersi: esito.punteggiPersi,
      };
    case "impatto":
      return { ok: false, motivo: "richiesto", impatto: esito.impatto };
    case "confermaRichiesta":
      return { ok: false, motivo: "conferma", impatto: esito.impatto };
    case "impattoCambiato":
      return { ok: false, motivo: "cambiato", impatto: esito.impatto };
    case "estranea":
    case "annullata":
    case "nonTrovata":
      return {
        ok: false,
        errori: { partite: RITIRO_MESSAGES.partitaNonValida },
      };
    case "giaRegistrata":
      return { ok: false, errori: { partite: RITIRO_MESSAGES.giaRegistrata } };
    case "versioneSuperata":
      return { ok: false, reason: "conflict" };
    case "nonRegistrabile":
      return { ok: false, reason: "nonRegistrabile" };
  }
}

/**
 * Tells the live pages: the voided matches, the recomputed group standings
 * with the withdrawal as text, the count of results to enter and the
 * board for w-admin-live. A failure here never undoes the save.
 */
async function pubblica(
  supabase: SupabaseClient | null,
  tappaId: string,
  categoria: Categoria,
  partiteIds: readonly string[],
  cambio: string,
) {
  try {
    const elenco = supabase
      ? await leggiPunteggi(supabase, tappaId)
      : getDemoPunteggi(tappaId);
    if (elenco) {
      const toccate = elenco.partite.filter((p) => partiteIds.includes(p.id));
      for (const p of toccate) publishScore(toLiveMatch(p, tappaId));
      const note = await leggiNoteAssenze(supabase, tappaId, categoria);
      for (const gironeId of new Set(toccate.map((p) => p.gironeId))) {
        const classifica = supabase
          ? await leggiClassificaGirone(supabase, gironeId)
          : classificaDemo(tappaId, gironeId);
        const delGirone = elenco.partite.filter((p) => p.gironeId === gironeId);
        if (!classifica || delGirone.length === 0) continue;
        publishGroupStandings(
          toGroupStandings(
            { id: gironeId, nome: delGirone[0].gironeNome },
            classifica,
            nomiGiocatori(delGirone),
            { stageId: tappaId, category: categoria },
            note,
          ),
        );
      }
      publishPendingScores({
        id: tappaId,
        label: elenco.tappa.nome,
        count: contaDaInserire(elenco.partite),
      });
    }
    await pubblicaTabellone({ supabase }, tappaId, categoria, cambio);
  } catch (error) {
    console.error("[ritiri] pubblicazione live non riuscita", error);
  }
}

function prossimo(prev: RitiroState): number {
  return prev.status === "idle" ? 1 : prev.at + 1;
}

/**
 * w-admin-ritiro: records a withdrawal or an absence of one player from
 * the chosen matches, applying `regola_ritiro()` (Q-09). FormData:
 * tappaId, categoria (m|f), iscrizioneId, nome (for the message), tipo,
 * one `partita` per match as «<id>:<versione>», and after
 * w-admin-impatto-fase: scelta, conferma ("1"), attesi.
 */
export async function registraRitiro(
  prev: RitiroState,
  formData: FormData,
): Promise<RitiroState> {
  const at = prossimo(prev);
  const tappaId = String(formData.get("tappaId") ?? "");
  const categoria = parseCategoriaSegmento(
    String(formData.get("categoria") ?? ""),
  );
  const validato = validaRitiro({
    iscrizioneId: formData.get("iscrizioneId"),
    tipo: formData.get("tipo"),
    partite: formData.getAll("partita"),
  });
  if (!validato.ok)
    return { status: "fieldErrors", errori: validato.errori, at };
  if (!tappaId || !categoria) {
    return {
      status: "error",
      reason: "nonRegistrabile",
      message: RITIRO_MESSAGES.nonRegistrabile,
      at,
    };
  }
  const { dati } = validato;

  const sessione = await sessioneAdmin();
  if (!sessione.ok) {
    return {
      status: "error",
      reason: sessione.reason,
      message: RITIRO_MESSAGES[sessione.reason],
      at,
    };
  }

  const sceltaRaw = formData.get("scelta");
  const attesiRaw = formData.get("attesi");
  const opzioni: OpzioniImpatto = {
    scelta: SCELTE_IMPATTO.find((s) => s === sceltaRaw) ?? null,
    conferma: formData.get("conferma") === "1",
    attesi: attesiRaw === null || attesiRaw === "" ? null : Number(attesiRaw),
  };

  let esito: Esito;
  try {
    esito = sessione.supabase
      ? await registraDb(sessione.supabase, dati, opzioni)
      : registraDemo(tappaId, categoria, dati, opzioni);
  } catch (error) {
    console.error("[ritiri] registrazione non riuscita", error);
    return {
      status: "error",
      reason: "network",
      message: RITIRO_MESSAGES.network,
      at,
    };
  }

  if (!esito.ok) {
    if ("errori" in esito)
      return { status: "fieldErrors", errori: esito.errori, at };
    if ("motivo" in esito) {
      if (!esito.impatto) {
        return {
          status: "error",
          reason: "network",
          message: RITIRO_MESSAGES.network,
          at,
        };
      }
      return {
        status: "impatto",
        impatto: esito.impatto,
        erroreConferma:
          esito.motivo === "conferma"
            ? erroreConferma(esito.impatto.punteggiPersi)
            : null,
        avviso:
          esito.motivo === "cambiato"
            ? messaggioImpattoCambiato(esito.impatto.punteggiPersi)
            : null,
        at,
      };
    }
    return {
      status: "error",
      reason: esito.reason,
      message: RITIRO_MESSAGES[esito.reason],
      at,
    };
  }

  const nome = esito.nome ?? String(formData.get("nome") ?? "").trim();
  const message = esitoRitiro({
    tipo: dati.tipo,
    nome: nome || "il giocatore",
    n: esito.partite,
    scelta: esito.scelta,
    punteggiPersi: esito.punteggiPersi,
  });
  await pubblica(
    sessione.supabase,
    tappaId,
    categoria,
    dati.partite.map((p) => p.partitaId),
    message,
  );
  refresh();
  return {
    status: "success",
    message,
    scelta: esito.scelta,
    punteggiPersi: esito.punteggiPersi,
    at,
  };
}
