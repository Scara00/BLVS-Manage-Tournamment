import { RICERCA_MIN_CARATTERI } from "./messages";

/** The words of a search, trimmed; empty when it is too short to run. */
export function paroleRicerca(query: string): string[] {
  const testo = query.trim().replace(/\s+/g, " ");
  if (testo.length < RICERCA_MIN_CARATTERI) return [];
  return testo.split(" ").slice(0, 4);
}

/** `%parola%` for ILIKE: `%`, `_` and `\` match themselves. */
function likePattern(parola: string): string {
  return `%${parola.replace(/[\\%_]/g, (m) => `\\${m}`)}%`;
}

/** A PostgREST value in double quotes: commas and brackets are safe. */
function quoted(value: string): string {
  return `"${value.replace(/["\\]/g, (m) => `\\${m}`)}"`;
}

/**
 * One PostgREST `or` filter per word: each word must be in the name, the
 * surname or the email, so «rossi luca» finds Luca Rossi.
 */
export function filtriRicerca(parole: readonly string[]): string[] {
  return parole.map((parola) => {
    const valore = quoted(likePattern(parola));
    return `nome.ilike.${valore},cognome.ilike.${valore},email.ilike.${valore}`;
  });
}
