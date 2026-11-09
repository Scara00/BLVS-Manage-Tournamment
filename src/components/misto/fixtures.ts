import type { Categoria, StatoPartita } from "@/lib/db/types";
import type { PartitaGirone } from "@/lib/gironi/classifica";
import { ROTAZIONE_MISTA } from "@/lib/tappe/avvio/regole";

/**
 * Fixtures of a mixed group of 4 men (A-D) + 4 women (E-H), shared by the
 * stories and tests of the mixed screens. Results are deterministic: the
 * team with the stronger man (A > B > C > D) wins 21-15. With the real
 * rotation that gives, ranked apart: men A, B, C, D (B over C on
 * head-to-head) and women G, F, H, E (F over H on head-to-head).
 */

export const LETTERE_MISTE = "ABCDEFGH".split("");

export function categoriaLettera(lettera: string): Categoria {
  return "ABCD".includes(lettera) ? "M" : "F";
}

const uomo = (lettere: readonly string[]) =>
  lettere.find((l) => categoriaLettera(l) === "M")!;

export type PartitaMista = PartitaGirone & {
  turno: number;
  /** The letters of each team, for labels. */
  lettere: { A: readonly string[]; B: readonly string[] };
};

/**
 * The 8 matches of a mixed group, with ids `${prefisso}-<letter>`. Turns
 * up to `giocati` are concluded, `inCorso` is being played (both matches),
 * later turns are still to play.
 */
export function partiteMiste(
  prefisso: string,
  {
    giocati = 4,
    inCorso = null,
  }: { giocati?: number; inCorso?: number | null } = {},
): PartitaMista[] {
  const id = (l: string) => `${prefisso}-${l}`;
  return ROTAZIONE_MISTA.map(({ turno, a, b }, i) => {
    const stato: StatoPartita =
      turno <= giocati
        ? "conclusa"
        : turno === inCorso
          ? "in_corso"
          : "programmata";
    const vinceA = uomo(a) < uomo(b);
    return {
      id: `${prefisso}-p${i + 1}`,
      turno,
      stato,
      squadre: { A: a.map(id), B: b.map(id) },
      lettere: { A: a, B: b },
      sets:
        stato === "conclusa"
          ? [vinceA ? { a: 21, b: 15 } : { a: 15, b: 21 }]
          : [],
    };
  });
}

/** Registration ids and categories of the group's players. */
export function giocatoriMisti(prefisso: string) {
  return LETTERE_MISTE.map((l) => ({
    iscrizioneId: `${prefisso}-${l}`,
    lettera: l,
    categoria: categoriaLettera(l),
  }));
}
