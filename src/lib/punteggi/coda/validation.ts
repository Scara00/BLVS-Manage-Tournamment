import { isUuid } from "@/lib/api/validation";
import type { SetPunteggio } from "@/lib/db/types";
import type { InvioPunteggio } from "./types";

/** Same bounds as PUT /api/admin/partite/:id/punteggio. */
export const MAX_SETS = 5;
export const MAX_PUNTI = 99;

export function leggiSets(raw: unknown): SetPunteggio[] | null {
  if (!Array.isArray(raw) || raw.length > MAX_SETS) return null;
  const valido = (n: unknown): n is number =>
    typeof n === "number" && Number.isInteger(n) && n >= 0 && n <= MAX_PUNTI;
  const sets: SetPunteggio[] = [];
  for (const item of raw) {
    const { a, b } = (item ?? {}) as Record<string, unknown>;
    if (!valido(a) || !valido(b)) return null;
    sets.push({ a, b });
  }
  return sets;
}

/**
 * The server action's input, checked (it comes from the device queue, so
 * from IndexedDB: never trust its shape). `null` when unusable.
 */
export function leggiInvio(raw: unknown): InvioPunteggio | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const sets = leggiSets(r.sets);
  if (
    typeof r.chiave !== "string" ||
    !isUuid(r.chiave) ||
    typeof r.partitaId !== "string" ||
    !isUuid(r.partitaId) ||
    !Number.isInteger(r.versione) ||
    (r.versione as number) < 1 ||
    !sets
  )
    return null;
  const autoreId =
    typeof r.autoreId === "string" && r.autoreId.length <= 64
      ? r.autoreId
      : null;
  return {
    chiave: r.chiave,
    partitaId: r.partitaId,
    versione: r.versione as number,
    sets,
    autoreId,
  };
}
