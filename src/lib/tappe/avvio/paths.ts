import type { Categoria } from "@/lib/db/types";
import type { ProblemaAvvio } from "./regole";

/**
 * URL segment of a board, `m` or `f`. Same as BLVS-28's
 * `CATEGORIA_SEGMENTO` (`src/lib/gironi/editor/types.ts`); switch to it
 * once both are merged.
 */
export const CATEGORIA_SEGMENTO: Record<Categoria, string> = { M: "m", F: "f" };

export const CATEGORIA_NOME: Record<Categoria, string> = {
  M: "maschile",
  F: "femminile",
};

/** Accepts `m`/`f` (any case) from the URL. */
export function parseCategoriaSegmento(segmento: string): Categoria | null {
  const valore = segmento.toUpperCase();
  return valore === "M" || valore === "F" ? valore : null;
}

/** w-admin-avvio-fase of one board. */
export function avvioFasePath(tappaId: string, categoria: Categoria): string {
  return `/admin/tappe/${encodeURIComponent(tappaId)}/avvio/${CATEGORIA_SEGMENTO[categoria]}`;
}

/**
 * The groups editor of one board (BLVS-28, w-admin-gironi), same path as
 * its `gironiEditorPath`.
 */
export function gironiPath(tappaId: string, categoria: Categoria): string {
  return `/admin/tappe/${encodeURIComponent(tappaId)}/gironi/${CATEGORIA_SEGMENTO[categoria]}`;
}

/**
 * Where an error sends the admin to fix it: the group in the editor, or
 * the «Non assegnati» column for players out of every group.
 * TODO(BLVS-28): align the anchors with the ids the editor renders.
 */
export function linkProblema(
  tappaId: string,
  categoria: Categoria,
  problema: ProblemaAvvio,
): string {
  const base = gironiPath(tappaId, categoria);
  if (problema.gironeId) {
    return `${base}#girone-${encodeURIComponent(problema.gironeId)}`;
  }
  return problema.regola === "non_assegnato" ? `${base}#non-assegnati` : base;
}
