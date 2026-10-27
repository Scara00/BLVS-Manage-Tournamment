/**
 * Reads a group's matches and stored tie decisions through a Supabase
 * client (RLS applies: race data is public, decisions are written by
 * admins only), and saves an admin's order for a perfect tie.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { StatoPartita } from "@/lib/db/types";
import {
  classificaGirone,
  ordineValido,
  type ClassificaGirone,
  type DecisioneSpareggio,
  type PartitaGirone,
  type SetGioco,
} from "./classifica";

export type PartitaGironeRow = {
  id: string;
  stato: StatoPartita;
  /** One-to-one embed: PostgREST returns an object (or null). */
  punteggi: { sets: SetGioco[] } | { sets: SetGioco[] }[] | null;
  partita_giocatori: { iscrizione_id: string; squadra: "A" | "B" }[];
};

export function toPartitaGirone(row: PartitaGironeRow): PartitaGirone {
  const punteggio = Array.isArray(row.punteggi)
    ? row.punteggi[0]
    : row.punteggi;
  const squadra = (s: "A" | "B") =>
    row.partita_giocatori
      .filter((g) => g.squadra === s)
      .map((g) => g.iscrizione_id);
  return {
    id: row.id,
    stato: row.stato,
    squadre: { A: squadra("A"), B: squadra("B") },
    sets: punteggio?.sets ?? [],
  };
}

/** The standing of `gironeId`, or null when the group doesn't exist. */
export async function leggiClassificaGirone(
  supabase: SupabaseClient,
  gironeId: string,
): Promise<ClassificaGirone | null> {
  const [girone, iscritti, partite, decisioni] = await Promise.all([
    supabase.from("gironi").select("id").eq("id", gironeId).maybeSingle(),
    supabase
      .from("girone_iscrizioni")
      .select("iscrizione_id")
      .eq("girone_id", gironeId)
      .order("iscrizione_id"),
    supabase
      .from("partite")
      .select(
        "id, stato, punteggi(sets), partita_giocatori(iscrizione_id, squadra)",
      )
      .eq("girone_id", gironeId),
    supabase
      .from("spareggi_girone")
      .select("firma, ordine")
      .eq("girone_id", gironeId),
  ]);
  for (const { error } of [girone, iscritti, partite, decisioni]) {
    if (error) throw new Error(`classifica girone: ${error.message}`);
  }
  if (!girone.data) return null;

  return classificaGirone(
    (iscritti.data as { iscrizione_id: string }[]).map((r) => r.iscrizione_id),
    (partite.data as PartitaGironeRow[]).map(toPartitaGirone),
    { decisioni: decisioni.data as DecisioneSpareggio[] },
  );
}

export const MOTIVO_SPAREGGIO_MAX = 500;

export const SPAREGGIO_MESSAGES = {
  motivoMancante: "Scrivi come è stata decisa la parità.",
  motivoLungo: `Il motivo può avere al massimo ${MOTIVO_SPAREGGIO_MAX} caratteri.`,
  ordineNonValido: "L'ordine deve elencare una volta ciascun giocatore pari.",
  conflict:
    "La classifica è cambiata nel frattempo: ricarica e controlla di nuovo la parità.",
  permissionDenied: "Solo l'organizzazione può decidere una parità.",
  archiviata: "La tappa è archiviata: la classifica non si modifica più.",
  network: "Non è stato possibile salvare la decisione. Riprova.",
} as const;

export type RisolviParitaInput = {
  gironeId: string;
  /** `ParitaPerfetta.firma` of the tie the admin looked at. */
  firma: string;
  /** Registration ids, best first. */
  ordine: readonly string[];
  motivo: string;
};

export type RisolviParitaEsito =
  | { ok: true; classifica: ClassificaGirone }
  | {
      ok: false;
      reason: "invalid" | "conflict" | "permissionDenied" | "network";
      message: string;
    };

type PgError = { code?: string; hint?: string | null; message?: string };

/**
 * Stores the admin's order for a perfect tie. The tie is checked against
 * the standing as it is now: if a score changed it, the call answers
 * `conflict` instead of fixing an order nobody looked at. The RPC checks
 * the admin role and the players again.
 */
export async function risolviParitaGirone(
  supabase: SupabaseClient,
  { gironeId, firma, ordine, motivo }: RisolviParitaInput,
): Promise<RisolviParitaEsito> {
  const testo = motivo.trim();
  if (!testo) {
    return {
      ok: false,
      reason: "invalid",
      message: SPAREGGIO_MESSAGES.motivoMancante,
    };
  }
  if (testo.length > MOTIVO_SPAREGGIO_MAX) {
    return {
      ok: false,
      reason: "invalid",
      message: SPAREGGIO_MESSAGES.motivoLungo,
    };
  }

  const attuale = await leggiClassificaGirone(supabase, gironeId);
  const parita = attuale?.parita.find((p) => p.firma === firma);
  if (!parita) {
    return {
      ok: false,
      reason: "conflict",
      message: SPAREGGIO_MESSAGES.conflict,
    };
  }
  if (!ordineValido(ordine, parita.iscrizioni)) {
    return {
      ok: false,
      reason: "invalid",
      message: SPAREGGIO_MESSAGES.ordineNonValido,
    };
  }

  const { error } = await supabase.rpc("risolvi_parita_girone", {
    p_girone: gironeId,
    p_firma: firma,
    p_ordine: ordine,
    p_motivo: testo,
  });
  if (error) return { ok: false, ...erroreDb(error) };

  const classifica = await leggiClassificaGirone(supabase, gironeId);
  if (!classifica) {
    return {
      ok: false,
      reason: "conflict",
      message: SPAREGGIO_MESSAGES.conflict,
    };
  }
  return { ok: true, classifica };
}

function erroreDb(error: PgError): {
  reason: "invalid" | "conflict" | "permissionDenied" | "network";
  message: string;
} {
  switch (error.hint) {
    case "ordine_non_valido":
      return { reason: "invalid", message: SPAREGGIO_MESSAGES.ordineNonValido };
    case "motivo_mancante":
      return { reason: "invalid", message: SPAREGGIO_MESSAGES.motivoMancante };
    case "tappa_archiviata":
      return { reason: "conflict", message: SPAREGGIO_MESSAGES.archiviata };
    case "girone_non_trovato":
      return { reason: "conflict", message: SPAREGGIO_MESSAGES.conflict };
  }
  if (error.code === "42501") {
    return {
      reason: "permissionDenied",
      message: SPAREGGIO_MESSAGES.permissionDenied,
    };
  }
  console.error("[gironi] decisione della parità non salvata", error);
  return { reason: "network", message: SPAREGGIO_MESSAGES.network };
}
