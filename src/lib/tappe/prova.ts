import type { StatoTappa } from "@/lib/db/types";

/**
 * Tappa di prova (migration 20261108120000_tappa_di_prova): a draft the
 * admin plays end to end to try the app on a real case, still unpublished.
 * Mirror of `public.stato_di_gioco()`: change both.
 */
export type ConProva = { stato: StatoTappa; prova?: boolean | null };

/** A draft switched to test mode. */
export function inProva(tappa: ConProva): boolean {
  return tappa.stato === "bozza" && tappa.prova === true;
}

/**
 * The state the group features check (start, scores, live, phases,
 * finals, closing): a test draft plays like a stage in progress; every
 * other stage keeps its own state.
 */
export function statoDiGioco(tappa: ConProva): StatoTappa {
  return inProva(tappa) ? "in_corso" : tappa.stato;
}

/** PostgREST filter: the stages a page may show (non-drafts, test drafts). */
export const FILTRO_TAPPA_VISIBILE = "stato.neq.bozza,prova.is.true";

/** Shown wherever a test draft is played or previewed. */
export const AVVISO_PROVA =
  "Tappa di prova: è ancora una bozza, la vedi solo tu (admin). I giocatori non la vedono e non entra nella classifica generale.";
