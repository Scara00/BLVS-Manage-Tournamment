"use server";

import type { SupabaseClient } from "@supabase/supabase-js";
import { refresh } from "next/cache";
import { getCurrentUser, type CurrentUser } from "@/lib/auth/session";
import type { Categoria, SetPunteggio } from "@/lib/db/types";
import {
  cambiaStatoDemo,
  finaliTappaDemo,
  getDemoTabelloneLive,
  salvaPunteggioDemo,
} from "@/lib/demo/admin-live";
import { firmaPunti, puntiCheCambiano } from "@/lib/tappe/chiusura/punti";
import { conSetsCorretti } from "@/lib/tappe/chiusura/regole";
import { classificaTappa } from "@/lib/tappe/classifica/classifica";
import { leggiFinaliTappa } from "@/lib/tappe/classifica/dati";
import { readSupabaseEnv } from "@/lib/supabase/env";
import { now } from "@/lib/time/server-time";
import { parseCategoriaSegmento } from "@/lib/tappe/avvio/paths";
import {
  cambiaStatoDb,
  leggiTabelloneLive,
  salvaPunteggioDb,
  type EsitoModifica,
} from "./dati";
import { descriviPartita, setsLabel } from "./format";
import { pubblicaTabellone } from "./pubblica";
import { leggiPunteggio } from "./punteggio";
import {
  LIVE_ADMIN_MESSAGES,
  OPERAZIONI_PARTITA,
  type AzionePartitaState,
  type OperazionePartita,
} from "./state";
import type { PartitaLive } from "./types";

type Sessione =
  | { ok: true; supabase: SupabaseClient | null; utenteId: string | null }
  | { ok: false; reason: "sessionExpired" | "permissionDenied" };

/** Admin role checked on the server; RLS checks it again on every write. */
async function sessioneAdmin(): Promise<Sessione> {
  if (!readSupabaseEnv()) return { ok: true, supabase: null, utenteId: null };
  let user: CurrentUser | null;
  try {
    user = await getCurrentUser();
  } catch (error) {
    console.error("[admin-live] verifica della sessione non riuscita", error);
    user = null;
  }
  if (!user) return { ok: false, reason: "sessionExpired" };
  if (user.ruolo !== "admin") return { ok: false, reason: "permissionDenied" };
  return { ok: true, supabase: user.supabase, utenteId: user.id };
}

type Campi = { tappaId: string; categoria: Categoria; partitaId: string };

function leggiCampi(formData: FormData): Campi | null {
  const tappaId = String(formData.get("tappaId") ?? "");
  const partitaId = String(formData.get("partitaId") ?? "");
  const categoria = parseCategoriaSegmento(
    String(formData.get("categoria") ?? ""),
  );
  if (!tappaId || !partitaId || !categoria) return null;
  return { tappaId, categoria, partitaId };
}

function errore(
  reason: Extract<AzionePartitaState, { status: "error" }>["reason"],
  message: string,
  at: number,
): AzionePartitaState {
  return { status: "error", reason, message, at };
}

function daEsitoKo(
  esito: Extract<EsitoModifica, { ok: false }>,
  at: number,
): AzionePartitaState {
  return errore("conflict", LIVE_ADMIN_MESSAGES[esito.motivo], at);
}

/** Publishes the change, refreshes the page and says what happened. */
async function fine(
  sessione: Extract<Sessione, { ok: true }>,
  campi: Campi,
  partita: PartitaLive,
  cambio: string,
  at: number,
): Promise<AzionePartitaState> {
  await pubblicaTabellone(sessione, campi.tappaId, campi.categoria, cambio);
  refresh();
  return {
    status: "success",
    partitaId: partita.id,
    message: `${cambio}.`,
    at,
  };
}

/**
 * «Inizia» (da giocare → in corso) or «Concludi» (in corso → conclusa)
 * from w-admin-live. Every other admin's screen updates over the live
 * channel.
 */
export async function aggiornaPartita(
  _prev: AzionePartitaState,
  formData: FormData,
): Promise<AzionePartitaState> {
  const at = now().getTime();
  const sessione = await sessioneAdmin();
  if (!sessione.ok) {
    return errore(sessione.reason, LIVE_ADMIN_MESSAGES[sessione.reason], at);
  }
  const campi = leggiCampi(formData);
  const operazione = String(formData.get("operazione") ?? "");
  if (
    !campi ||
    !(OPERAZIONI_PARTITA as readonly string[]).includes(operazione)
  ) {
    return errore("conflict", LIVE_ADMIN_MESSAGES.nonTrovata, at);
  }
  const op = operazione as OperazionePartita;

  let esito: EsitoModifica;
  try {
    esito = sessione.supabase
      ? await cambiaStatoDb(sessione.supabase, campi.partitaId, op)
      : cambiaStatoDemo(campi.tappaId, campi.categoria, campi.partitaId, op);
  } catch (error) {
    console.error("[admin-live] cambio di stato non riuscito", error);
    return errore("network", LIVE_ADMIN_MESSAGES.network, at);
  }
  if (!esito.ok) return daEsitoKo(esito, at);

  const stato = op === "inizia" ? "partita in corso" : "partita conclusa";
  return fine(
    sessione,
    campi,
    esito.partita,
    `${descriviPartita(esito.partita)}: ${stato}`,
    at,
  );
}

/**
 * Saves the score typed in the dialog (`versione` = the one read) and,
 * from «Salva e concludi», closes the match too.
 */
export async function salvaPunteggio(
  _prev: AzionePartitaState,
  formData: FormData,
): Promise<AzionePartitaState> {
  const at = now().getTime();
  const sessione = await sessioneAdmin();
  if (!sessione.ok) {
    return errore(sessione.reason, LIVE_ADMIN_MESSAGES[sessione.reason], at);
  }
  const campi = leggiCampi(formData);
  const versione = Number(formData.get("versione"));
  if (!campi || !Number.isInteger(versione) || versione < 1) {
    return errore("conflict", LIVE_ADMIN_MESSAGES.nonTrovata, at);
  }
  const letto = leggiPunteggio((campo) => String(formData.get(campo) ?? ""));
  if (!letto.ok) {
    return {
      status: "fieldErrors",
      errori: letto.errori,
      message: LIVE_ADMIN_MESSAGES.punteggioNonValido,
      at,
    };
  }
  const concludi = formData.get("concludi") === "1";

  // BLVS-43: on a concluded board a correction is confirmed explicitly,
  // after the admin saw which points change.
  let conclusa: Awaited<ReturnType<typeof correzioneConclusa>>;
  try {
    conclusa = await correzioneConclusa(
      sessione,
      campi,
      versione,
      letto.sets,
      formData,
      at,
    );
  } catch (error) {
    console.error("[admin-live] correzione su tabellone concluso", error);
    return errore("network", LIVE_ADMIN_MESSAGES.network, at);
  }
  if (conclusa && "status" in conclusa) return conclusa;

  let esito: EsitoModifica;
  try {
    if (conclusa) {
      esito = sessione.supabase
        ? await correggiConclusoDb(
            sessione.supabase,
            conclusa.partita,
            versione,
            letto.sets,
          )
        : salvaPunteggioDemo(
            campi.tappaId,
            campi.categoria,
            campi.partitaId,
            versione,
            letto.sets,
            false,
            true,
          );
    } else {
      esito = sessione.supabase
        ? await salvaPunteggioDb(
            sessione.supabase,
            sessione.utenteId ?? "",
            campi.partitaId,
            versione,
            letto.sets,
            concludi,
          )
        : salvaPunteggioDemo(
            campi.tappaId,
            campi.categoria,
            campi.partitaId,
            versione,
            letto.sets,
            concludi,
          );
    }
  } catch (error) {
    console.error("[admin-live] punteggio non salvato", error);
    return errore("network", LIVE_ADMIN_MESSAGES.network, at);
  }
  if (!esito.ok) {
    if (esito.motivo === "senzaVincitore") {
      return {
        status: "fieldErrors",
        errori: { sets: LIVE_ADMIN_MESSAGES.senzaVincitore },
        message: LIVE_ADMIN_MESSAGES.punteggioNonValido,
        at,
      };
    }
    return daEsitoKo(esito, at);
  }

  const punteggio = setsLabel(esito.partita.sets) ?? "";
  const cambio = conclusa
    ? `${descriviPartita(esito.partita)}: ${LIVE_ADMIN_MESSAGES.correttoConcluso} ${punteggio}`
    : `${descriviPartita(esito.partita)}: punteggio ${punteggio}${
        concludi ? ", partita conclusa" : ""
      }`;
  return fine(sessione, campi, esito.partita, cambio, at);
}

/**
 * BLVS-43. Null on an open board (the normal save). On a concluded one:
 * without `conferma=1` (or when the points changed since `firma`) the
 * state that asks for the confirmation, listing the points that change;
 * with it, the match to correct.
 */
async function correzioneConclusa(
  sessione: Extract<Sessione, { ok: true }>,
  campi: Campi,
  versione: number,
  sets: SetPunteggio[],
  formData: FormData,
  at: number,
): Promise<AzionePartitaState | { partita: PartitaLive } | null> {
  const adesso = now();
  const tabellone = sessione.supabase
    ? await leggiTabelloneLive(
        sessione.supabase,
        campi.tappaId,
        campi.categoria,
        adesso,
      )
    : getDemoTabelloneLive(campi.tappaId, campi.categoria, adesso);
  if (!tabellone || tabellone.conclusoIl === null) return null;
  const partita = tabellone.partite.find((p) => p.id === campi.partitaId);
  if (!partita) return errore("conflict", LIVE_ADMIN_MESSAGES.nonTrovata, at);
  if (partita.versione !== versione) {
    return errore("conflict", LIVE_ADMIN_MESSAGES.conflict, at);
  }

  const dati = sessione.supabase
    ? await leggiFinaliTappa(sessione.supabase, campi.tappaId, campi.categoria)
    : finaliTappaDemo(campi.tappaId, campi.categoria);
  const finali = dati?.finali ?? [];
  const prima = classificaTappa({ finali, concluso: true });
  const dopo = classificaTappa({
    finali: conSetsCorretti(finali, partita.id, sets),
    concluso: true,
  });
  const firma = firmaPunti(prima);
  const confermata = formData.get("conferma") === "1";
  const vista = String(formData.get("firma") ?? "");
  if (confermata && vista === firma) return { partita };
  return {
    status: "confermaConcluso",
    partitaId: partita.id,
    sets,
    cambi: puntiCheCambiano(prima, dopo),
    firma,
    avviso: confermata ? LIVE_ADMIN_MESSAGES.puntiCambiati : null,
    message: LIVE_ADMIN_MESSAGES.confermaConcluso,
    at,
  };
}

/** `correggi_tabellone_concluso`: the confirmed correction (BLVS-43). */
async function correggiConclusoDb(
  supabase: SupabaseClient,
  partita: PartitaLive,
  versione: number,
  sets: SetPunteggio[],
): Promise<EsitoModifica> {
  const { data, error } = await supabase.rpc("correggi_tabellone_concluso", {
    p_partita: partita.id,
    p_versione: versione,
    p_sets: sets,
  });
  if (error) {
    switch (error.hint) {
      case "senza_vincitore":
        return { ok: false, motivo: "senzaVincitore" };
      case "tappa_archiviata":
        return { ok: false, motivo: "tappaChiusa" };
      case "versione_superata":
      case "partita_non_conclusa":
      case "tabellone_non_concluso":
        return { ok: false, motivo: "conflict" };
    }
    throw error;
  }
  return {
    ok: true,
    partita: { ...partita, sets, versione: Number(data) },
  };
}
