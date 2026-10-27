import type { FaseTabellone } from "@/lib/db/types";

/**
 * Stage points per final position (R-41), by phase: index 0 is the 1st.
 * Positions past the table earn nothing. These are client decisions:
 * change them here only.
 */
export const PUNTI_PER_POSIZIONE: Readonly<
  Record<FaseTabellone, readonly number[]>
> = {
  gold: [12, 8, 4, 2],
  silver: [8, 6, 2, 1],
};

/** Points for `posizione` (1-based) in a `fase` final. */
export function puntiPerPosizione(
  fase: FaseTabellone,
  posizione: number,
): number {
  if (!Number.isInteger(posizione) || posizione < 1) {
    throw new Error(`Posizione non valida: ${posizione}`);
  }
  return PUNTI_PER_POSIZIONE[fase][posizione - 1] ?? 0;
}
