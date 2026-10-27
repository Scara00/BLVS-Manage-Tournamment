"use server";

import type { SupabaseClient } from "@supabase/supabase-js";
import { refresh } from "next/cache";
import { getCurrentUser, type CurrentUser } from "@/lib/auth/session";
import type { Categoria } from "@/lib/db/types";
import { cambiaStatoDemo, salvaPunteggioDemo } from "@/lib/demo/admin-live";
import { readSupabaseEnv } from "@/lib/supabase/env";
import { now } from "@/lib/time/server-time";
import { parseCategoriaSegmento } from "@/lib/tappe/avvio/paths";
import { cambiaStatoDb, salvaPunteggioDb, type EsitoModifica } from "./dati";
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

  let esito: EsitoModifica;
  try {
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
  const cambio = `${descriviPartita(esito.partita)}: punteggio ${punteggio}${
    concludi ? ", partita conclusa" : ""
  }`;
  return fine(sessione, campi, esito.partita, cambio, at);
}
