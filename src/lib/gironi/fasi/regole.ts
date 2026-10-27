/**
 * How players move on after the initial groups (BLVS-39). Mirror of
 * `public.regola_qualificazione()` and `public.regola_finali()` (migration
 * 20261027410000_gironi_gold_silver_finali.sql): change both together.
 * TODO(Q-01): still to be confirmed by the client.
 */
export type RegolaQualificazione = {
  /** Places of each initial group that go to the gold groups. */
  gold: readonly number[];
  /** Places that go to the silver groups. */
  silver: readonly number[];
};

export const REGOLA_QUALIFICAZIONE: RegolaQualificazione = {
  gold: [1, 2],
  silver: [3, 4],
};

/** A final is one King/Queen group of `giocatori` players. */
export type RegolaFinali = { giocatori: number };

export const REGOLA_FINALI: RegolaFinali = { giocatori: 4 };
