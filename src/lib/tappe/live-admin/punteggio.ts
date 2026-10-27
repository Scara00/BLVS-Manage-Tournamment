import type { SetPunteggio } from "@/lib/db/types";

/** Beach volley: best of three sets. */
export const SET_MASSIMI = 3;
/** Same ceiling as PUT /api/admin/partite/[id]/punteggio. */
export const PUNTI_MASSIMI = 99;

/** Form field of one team's points in set `n` (1-based). */
export function campoSet(n: number, squadra: "a" | "b"): string {
  return `set${n}${squadra}`;
}

export type ErroriPunteggio = Partial<Record<string, string>>;

export type LetturaPunteggio =
  { ok: true; sets: SetPunteggio[] } | { ok: false; errori: ErroriPunteggio };

function leggiPunti(raw: string): number | null | "invalido" {
  const valore = raw.trim();
  if (valore === "") return null;
  if (!/^\d{1,2}$/.test(valore)) return "invalido";
  const n = Number(valore);
  return n <= PUNTI_MASSIMI ? n : "invalido";
}

/**
 * Reads the sets typed in the score dialog. Each set needs both teams'
 * points (0–99) and a winner; empty sets are allowed only at the end; at
 * least one set. Errors are keyed `set1`…`set3`, or `sets` for the whole.
 */
export function leggiPunteggio(
  valore: (campo: string) => string,
): LetturaPunteggio {
  const errori: ErroriPunteggio = {};
  const sets: SetPunteggio[] = [];
  let vuotoPrima: number | null = null;

  for (let n = 1; n <= SET_MASSIMI; n++) {
    const a = leggiPunti(valore(campoSet(n, "a")));
    const b = leggiPunti(valore(campoSet(n, "b")));
    const chiave = `set${n}`;
    if (a === null && b === null) {
      vuotoPrima ??= n;
      continue;
    }
    if (a === "invalido" || b === "invalido") {
      errori[chiave] = `Set ${n}: scrivi punti interi da 0 a ${PUNTI_MASSIMI}.`;
    } else if (a === null || b === null) {
      errori[chiave] = `Set ${n}: scrivi i punti di entrambe le squadre.`;
    } else if (a === b) {
      errori[chiave] = `Set ${n}: un set non può finire in parità.`;
    } else if (vuotoPrima !== null) {
      errori[chiave] = `Set ${n}: compila prima il set ${vuotoPrima}.`;
    } else {
      sets.push({ a, b });
    }
  }

  if (Object.keys(errori).length > 0) return { ok: false, errori };
  if (sets.length === 0) {
    return {
      ok: false,
      errori: { sets: "Scrivi il punteggio di almeno un set." },
    };
  }
  return { ok: true, sets };
}
