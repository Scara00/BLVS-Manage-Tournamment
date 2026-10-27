/**
 * The set rule (R-32, Q-04): one set per match, won by the first team to
 * `punti` with at least `scarto` points of margin; past `punti` play goes
 * on until a team leads by exactly `scarto` (no cap).
 *
 * Mirrors `public.regola_set()` (migration
 * `20261027381000_inserimento_punteggio.sql`): change them together, a
 * PGlite test compares them.
 * TODO(Q-04): confirm the values with the client.
 */
export type RegolaSet = {
  punti: number;
  scarto: number;
};

export const REGOLA_SET: RegolaSet = { punti: 21, scarto: 2 };

/** «Si vince a 21 con almeno 2 punti di scarto.» */
export function spiegaRegolaSet(regola: RegolaSet = REGOLA_SET): string {
  return `Si vince a ${regola.punti} con almeno ${regola.scarto} punti di scarto; oltre i ${regola.punti} si gioca finché una squadra va avanti di ${regola.scarto}.`;
}

/**
 * How long after a save «Annulla» is still accepted by the server. The
 * toast shows it for 10 s, paused on hover or focus, so the server keeps a
 * margin. Mirrors the interval in `public.annulla_punteggio`.
 */
export const FINESTRA_ANNULLAMENTO_SECONDI = 120;

/** How long the «Annulla» toast stays up (R-35: at least 10 s). */
export const DURATA_ANNULLA_MS = 10_000;
