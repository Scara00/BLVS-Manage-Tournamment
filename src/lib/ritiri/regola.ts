/**
 * The rule applied to the matches of a player who withdraws or misses them
 * (R-35, Q-09). TODO(Q-09): still to be confirmed by the client. Mirror of
 * `public.regola_ritiro()`: change both together (a PGlite test compares
 * them).
 */
import type { SetPunteggio, StatoPartita } from "@/lib/db/types";

/**
 * `annulla`: the match is voided and leaves the group standing.
 * `tavolino`: the player's team loses it `puntiPerdente`–`puntiVincitore`.
 */
export type EsitoRitiro = "annulla" | "tavolino";

export type RegolaRitiro = {
  esito: EsitoRitiro;
  puntiVincitore: number;
  puntiPerdente: number;
};

export const REGOLA_RITIRO: RegolaRitiro = {
  esito: "annulla",
  puntiVincitore: 21,
  puntiPerdente: 0,
};

/** The rule as the admin reads it before confirming. */
export function spiegaRegolaRitiro(regola: RegolaRitiro = REGOLA_RITIRO) {
  if (regola.esito === "annulla") {
    return "Ogni partita scelta viene annullata: non conta più nella classifica del girone, per nessuno dei quattro giocatori. Un punteggio già inserito si perde e resta nel registro come correzione.";
  }
  return `Ogni partita scelta finisce ${regola.puntiPerdente}–${regola.puntiVincitore} a tavolino: la perde la coppia del giocatore, compagno compreso. Un punteggio già inserito viene sostituito e resta nel registro come correzione.`;
}

export type PartitaDaRitirare = {
  stato: StatoPartita;
  sets: readonly SetPunteggio[];
  /** Registration ids of each team. */
  squadre: { A: readonly string[]; B: readonly string[] };
};

/** A match after the rule, for `iscrizioneId` withdrawing from it. */
export function applicaRegola(
  partita: PartitaDaRitirare,
  iscrizioneId: string,
  regola: RegolaRitiro = REGOLA_RITIRO,
): { stato: StatoPartita; sets: SetPunteggio[] } {
  if (regola.esito === "annulla") return { stato: "annullata", sets: [] };
  const inA = partita.squadre.A.includes(iscrizioneId);
  const set = inA
    ? { a: regola.puntiPerdente, b: regola.puntiVincitore }
    : { a: regola.puntiVincitore, b: regola.puntiPerdente };
  return { stato: "conclusa", sets: [set] };
}
