/**
 * Season filter (Q-06). A stage's season is `tappe.stagione`, set by the
 * admin and defaulting to the year of its first day.
 */

/** The filter is shown on w-classifica (client decision Q-06: on). */
export const FILTRO_STAGIONE_ATTIVO = true;

export const STAGIONE_MIN = 2000;
export const STAGIONE_MAX = 2100;

/** A valid season from user input, or null. */
export function parseStagione(valore: unknown): number | null {
  if (typeof valore !== "string" && typeof valore !== "number") return null;
  const testo = String(valore).trim();
  if (!/^\d{4}$/.test(testo)) return null;
  const anno = Number(testo);
  return anno >= STAGIONE_MIN && anno <= STAGIONE_MAX ? anno : null;
}

/** The season of a `YYYY-MM-DD` day: its calendar year. */
export function stagioneDaData(data: string): number {
  return Number(data.slice(0, 4));
}

/**
 * The season to show: the requested one when it exists, else the newest
 * season with stages, else `fallback` (the current year).
 */
export function stagioneScelta(
  richiesta: number | null,
  stagioni: readonly number[],
  fallback: number,
): number {
  if (richiesta !== null && stagioni.includes(richiesta)) return richiesta;
  return stagioni.length > 0 ? Math.max(...stagioni) : fallback;
}

export function stagioneLabel(stagione: number | null): string {
  return stagione === null ? "Tutte le stagioni" : `Stagione ${stagione}`;
}
