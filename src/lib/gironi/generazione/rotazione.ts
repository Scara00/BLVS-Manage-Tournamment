import { REGOLA_GIRONI } from "@/lib/tappe/gironi";

/**
 * BLVS-26 · Groups of 4 and their King/Queen matches. Pure mirror of RPC
 * `public.genera_gironi()` (migration 20261027346000_genera_gironi.sql),
 * which is what actually writes the groups: keep the two in step.
 * TODO(Q-05): the leftovers of an incomplete group are drawn at random and
 * only reported; their registration does not change.
 */

/** Players per group: the rotation below only works with 4. */
export const DIMENSIONE_GIRONE = REGOLA_GIRONI.dimensione;

/** Positions (0..3 = A..D) of each team, turn by turn. */
export const ROTAZIONE_GIRONE = [
  { turno: 1, squadraA: [0, 1], squadraB: [2, 3] },
  { turno: 2, squadraA: [0, 2], squadraB: [1, 3] },
  { turno: 3, squadraA: [0, 3], squadraB: [1, 2] },
] as const;

export type PartitaGirone<T> = {
  turno: number;
  squadraA: [T, T];
  squadraB: [T, T];
};

export type Sorteggio<T> = {
  /** Full groups, in order (Girone A, B, …), players in positions A..D. */
  gironi: T[][];
  /** Who does not complete a group: reported to the admin. */
  esclusi: T[];
};

/** Name of the group at `posizione` (1-based), like the database writes it. */
export function nomeGirone(posizione: number): string {
  return posizione <= 26
    ? `Girone ${String.fromCharCode(64 + posizione)}`
    : `Girone ${posizione}`;
}

/** Fisher–Yates shuffle; `random` returns a number in [0, 1). */
export function mescola<T>(
  elementi: readonly T[],
  random: () => number = Math.random,
): T[] {
  const copia = [...elementi];
  for (let i = copia.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [copia[i], copia[j]] = [copia[j], copia[i]];
  }
  return copia;
}

/**
 * Splits `iscritti`, in the order given, into full groups of 4; the last
 * `n % 4` are left out. Shuffle first (`mescola`) for a draw.
 */
export function componiGironi<T>(iscritti: readonly T[]): Sorteggio<T> {
  const completi = Math.floor(iscritti.length / DIMENSIONE_GIRONE);
  const gironi: T[][] = [];
  for (let g = 0; g < completi; g++) {
    gironi.push(
      iscritti.slice(g * DIMENSIONE_GIRONE, (g + 1) * DIMENSIONE_GIRONE),
    );
  }
  return { gironi, esclusi: iscritti.slice(completi * DIMENSIONE_GIRONE) };
}

/** Draws the groups of one board at random. */
export function sorteggiaGironi<T>(
  iscritti: readonly T[],
  random: () => number = Math.random,
): Sorteggio<T> {
  return componiGironi(mescola(iscritti, random));
}

/** The 3 matches of a group: A+B v C+D, A+C v B+D, A+D v B+C. */
export function partiteGirone<T>(girone: readonly T[]): PartitaGirone<T>[] {
  if (girone.length !== DIMENSIONE_GIRONE) {
    throw new Error(`Un girone ha ${DIMENSIONE_GIRONE} giocatori`);
  }
  return ROTAZIONE_GIRONE.map(({ turno, squadraA, squadraB }) => ({
    turno,
    squadraA: [girone[squadraA[0]], girone[squadraA[1]]],
    squadraB: [girone[squadraB[0]], girone[squadraB[1]]],
  }));
}

/**
 * For each player of the matches, how many times they partner and face
 * each other player. A valid group: 1 as partner and 2 as opponent with
 * each of the other three.
 */
export function incontri<T>(partite: readonly PartitaGirone<T>[]): {
  compagni: Map<T, Map<T, number>>;
  avversari: Map<T, Map<T, number>>;
} {
  const compagni = new Map<T, Map<T, number>>();
  const avversari = new Map<T, Map<T, number>>();
  const conta = (mappa: Map<T, Map<T, number>>, a: T, b: T) => {
    const riga = mappa.get(a) ?? new Map<T, number>();
    riga.set(b, (riga.get(b) ?? 0) + 1);
    mappa.set(a, riga);
  };
  for (const { squadraA, squadraB } of partite) {
    for (const [noi, loro] of [
      [squadraA, squadraB],
      [squadraB, squadraA],
    ] as const) {
      conta(compagni, noi[0], noi[1]);
      conta(compagni, noi[1], noi[0]);
      for (const io of noi) for (const avv of loro) conta(avversari, io, avv);
    }
  }
  return { compagni, avversari };
}
