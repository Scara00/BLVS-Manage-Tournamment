"use server";

import type { SupabaseClient } from "@supabase/supabase-js";
import { refresh } from "next/cache";
import { isUuid } from "@/lib/api/validation";
import { getCurrentUser, type CurrentUser } from "@/lib/auth/session";
import {
  aggiungiDemoIscritto,
  cercaDemoGiocatori,
  rimuoviDemoIscritto,
} from "@/lib/demo/iscritti-admin";
import { readSupabaseEnv } from "@/lib/supabase/env";
import { now } from "@/lib/time/server-time";
import { erroreDaDb, erroreDaDemo, type ErroreIscritti } from "./errors";
import { nomeCompleto } from "./format";
import {
  aggiuntoMessage,
  ISCRITTI_MESSAGES,
  RICERCA_MAX_RISULTATI,
  rimossoMessage,
} from "./messages";
import { filtriRicerca, paroleRicerca } from "./search";
import type {
  CercaGiocatoriEsito,
  GiocatoreTrovato,
  ModificaIscrittiState,
} from "./types";

type Sessione =
  | { ok: true; supabase: SupabaseClient | null }
  | { ok: false; reason: "sessionExpired" | "permissionDenied" };

/**
 * The admin role is verified on the server for every call; RLS and the
 * RPCs check it again. Without Supabase env (CI, e2e) the in-memory demo
 * stages are used, as by the read.
 */
async function sessioneAdmin(): Promise<Sessione> {
  if (!readSupabaseEnv()) return { ok: true, supabase: null };
  let user: CurrentUser | null;
  try {
    user = await getCurrentUser();
  } catch (error) {
    console.error("[iscritti] verifica della sessione non riuscita", error);
    user = null;
  }
  if (!user) return { ok: false, reason: "sessionExpired" };
  if (user.ruolo !== "admin") return { ok: false, reason: "permissionDenied" };
  return { ok: true, supabase: user.supabase };
}

function text(value: FormDataEntryValue | null): string {
  return typeof value === "string" ? value : "";
}

function fallimento(errore: ErroreIscritti): ModificaIscrittiState {
  return { status: "error", ...errore, at: now().getTime() };
}

function successo(message: string): ModificaIscrittiState {
  refresh();
  return { status: "success", message, at: now().getTime() };
}

/**
 * w-admin-aggiungi-giocatore: registers the player `utenteId` on the board
 * of their category, also with registrations closed. The maximum and the
 * one-registration rule are checked by `admin_iscrivi_giocatore()` inside
 * one transaction with a lock on the board.
 */
export async function aggiungiIscritto(
  _prev: ModificaIscrittiState,
  formData: FormData,
): Promise<ModificaIscrittiState> {
  const sessione = await sessioneAdmin();
  if (!sessione.ok) {
    return fallimento({
      reason: sessione.reason,
      message: ISCRITTI_MESSAGES[sessione.reason],
    });
  }
  const tappaId = text(formData.get("tappaId"));
  const utenteId = text(formData.get("utenteId"));
  if (!tappaId || !utenteId) {
    return fallimento({
      reason: "invalid",
      message: ISCRITTI_MESSAGES.giocatoreNonTrovato,
    });
  }

  if (!sessione.supabase) {
    const esito = aggiungiDemoIscritto(tappaId, utenteId, now());
    if (!esito.ok) return fallimento(erroreDaDemo(esito));
    return successo(aggiuntoMessage(nomeCompleto(esito.row), esito.row.posto));
  }

  if (!isUuid(tappaId) || !isUuid(utenteId)) {
    return fallimento({
      reason: "invalid",
      message: ISCRITTI_MESSAGES.giocatoreNonTrovato,
    });
  }
  try {
    const { data, error } = await sessione.supabase
      .rpc("admin_iscrivi_giocatore", { p_tappa: tappaId, p_utente: utenteId })
      .select("posto")
      .single<{ posto: number | null }>();
    if (error) return fallimento(erroreDaDb(error));
    const { data: utente } = await sessione.supabase
      .from("utenti")
      .select("nome, cognome")
      .eq("id", utenteId)
      .maybeSingle<{ nome: string; cognome: string }>();
    return successo(
      aggiuntoMessage(
        utente ? nomeCompleto(utente) : "Il giocatore",
        data.posto,
      ),
    );
  } catch (error) {
    console.error("[iscritti] aggiunta non riuscita", error);
    return fallimento({
      reason: "network",
      message: ISCRITTI_MESSAGES.network,
    });
  }
}

/** Removes a registrant (`ritirata`): the seat is free again. */
export async function rimuoviIscritto(
  _prev: ModificaIscrittiState,
  formData: FormData,
): Promise<ModificaIscrittiState> {
  const sessione = await sessioneAdmin();
  if (!sessione.ok) {
    return fallimento({
      reason: sessione.reason,
      message: ISCRITTI_MESSAGES[sessione.reason],
    });
  }
  const tappaId = text(formData.get("tappaId"));
  const iscrizioneId = text(formData.get("iscrizioneId"));
  const nome = text(formData.get("nome")).slice(0, 200) || "del giocatore";
  if (!tappaId || !iscrizioneId) {
    return fallimento({
      reason: "invalid",
      message: ISCRITTI_MESSAGES.iscrizioneNonTrovata,
    });
  }

  if (!sessione.supabase) {
    const esito = rimuoviDemoIscritto(tappaId, iscrizioneId);
    if (!esito.ok) return fallimento(erroreDaDemo(esito));
    return successo(rimossoMessage(nomeCompleto(esito.row), esito.row.posto));
  }

  if (!isUuid(iscrizioneId)) {
    return fallimento({
      reason: "invalid",
      message: ISCRITTI_MESSAGES.iscrizioneNonTrovata,
    });
  }
  try {
    const { data, error } = await sessione.supabase
      .rpc("admin_rimuovi_iscrizione", { p_iscrizione: iscrizioneId })
      .select("posto")
      .single<{ posto: number | null }>();
    if (error) return fallimento(erroreDaDb(error));
    return successo(rimossoMessage(nome, data.posto));
  } catch (error) {
    console.error("[iscritti] rimozione non riuscita", error);
    return fallimento({
      reason: "network",
      message: ISCRITTI_MESSAGES.network,
    });
  }
}

/**
 * Registered players (role giocatore) whose name, surname or email holds
 * every word of `query`, by surname; at most `RICERCA_MAX_RISULTATI`.
 * Each says whether they are already registered to the stage.
 */
export async function cercaGiocatori(
  tappaId: string,
  query: string,
): Promise<CercaGiocatoriEsito> {
  const parole = paroleRicerca(String(query).slice(0, 100));
  if (parole.length === 0) return { status: "ok", giocatori: [] };

  const sessione = await sessioneAdmin();
  if (!sessione.ok) {
    return { status: "error", message: ISCRITTI_MESSAGES[sessione.reason] };
  }
  if (!sessione.supabase) {
    return {
      status: "ok",
      giocatori: cercaDemoGiocatori(tappaId, parole, RICERCA_MAX_RISULTATI),
    };
  }
  if (!isUuid(tappaId)) {
    return { status: "error", message: ISCRITTI_MESSAGES.tappaNonTrovata };
  }

  try {
    let ricerca = sessione.supabase
      .from("utenti")
      .select("id, nome, cognome, email, categoria")
      .eq("ruolo", "giocatore");
    for (const filtro of filtriRicerca(parole)) ricerca = ricerca.or(filtro);
    const { data, error } = await ricerca
      .order("cognome")
      .order("nome")
      .limit(RICERCA_MAX_RISULTATI);
    if (error) throw error;

    const trovati = data as Omit<GiocatoreTrovato, "iscritto">[];
    const ids = trovati.map((g) => g.id);
    let iscritti = new Set<string>();
    if (ids.length > 0) {
      const { data: righe, error: iscrizioniError } = await sessione.supabase
        .from("iscrizioni")
        .select("utente_id")
        .eq("tappa_id", tappaId)
        .in("stato", ["in_attesa", "confermata"])
        .in("utente_id", ids);
      if (iscrizioniError) throw iscrizioniError;
      iscritti = new Set(
        (righe as { utente_id: string }[]).map((r) => r.utente_id),
      );
    }
    return {
      status: "ok",
      giocatori: trovati.map((g) => ({ ...g, iscritto: iscritti.has(g.id) })),
    };
  } catch (error) {
    console.error("[iscritti] ricerca non riuscita", error);
    return { status: "error", message: ISCRITTI_MESSAGES.ricercaNonRiuscita };
  }
}
