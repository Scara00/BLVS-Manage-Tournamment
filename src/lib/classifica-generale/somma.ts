/**
 * Sum of the stage points per player (R-44). Pure: the stage standings are
 * computed on read (BLVS-40), so the overall one is too.
 */
import type { PartecipazioneTappa, RisultatoTappa } from "./types";

export type TotaleGiocatore = {
  utenteId: string;
  nome: string;
  anonimo: boolean;
  punti: number;
  tappeGiocate: number;
  puntiProvvisori: boolean;
  /** Newest first. */
  tappe: RisultatoTappa[];
};

const piuRecente = (a: RisultatoTappa, b: RisultatoTappa) =>
  b.data.localeCompare(a.data) || a.tappaId.localeCompare(b.tappaId);

/**
 * One total per player. A stage counts once per player (a repeat entry for
 * the same stage is ignored) and its points are provisional while its
 * board is open.
 */
export function sommaClassifica(
  partecipazioni: readonly PartecipazioneTappa[],
): TotaleGiocatore[] {
  const perGiocatore = new Map<string, TotaleGiocatore>();
  for (const { utenteId, nome, anonimo, risultato } of partecipazioni) {
    const totale = perGiocatore.get(utenteId) ?? {
      utenteId,
      nome,
      anonimo,
      punti: 0,
      tappeGiocate: 0,
      puntiProvvisori: false,
      tappe: [],
    };
    if (totale.tappe.some((t) => t.tappaId === risultato.tappaId)) continue;
    totale.tappe.push(risultato);
    totale.punti += risultato.punti;
    totale.tappeGiocate += 1;
    totale.puntiProvvisori ||= risultato.provvisori;
    perGiocatore.set(utenteId, totale);
  }
  return [...perGiocatore.values()].map((t) => ({
    ...t,
    tappe: [...t.tappe].sort(piuRecente),
  }));
}
