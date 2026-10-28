/** Name search on w-classifica (R-51): it filters the view, never re-ranks. */

/** Lower case, no accents, single spaces. */
export function normalizzaNome(testo: string): string {
  return testo
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/** Rows whose name contains every word of `query`; all rows when empty. */
export function filtraPerNome<Riga>(
  righe: readonly Riga[],
  query: string,
  nomeDi: (riga: Riga) => string,
): Riga[] {
  const parole = normalizzaNome(query).split(" ").filter(Boolean);
  if (parole.length === 0) return [...righe];
  return righe.filter((riga) => {
    const nome = normalizzaNome(nomeDi(riga));
    return parole.every((p) => nome.includes(p));
  });
}

export function risultatiRicercaLabel(trovati: number, query: string): string {
  if (normalizzaNome(query) === "") return "";
  if (trovati === 0) return `Nessun giocatore trovato per «${query.trim()}».`;
  return trovati === 1
    ? "1 giocatore trovato."
    : `${trovati} giocatori trovati.`;
}
