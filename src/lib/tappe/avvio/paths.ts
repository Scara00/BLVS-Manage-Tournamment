import type { CategoriaTabellone } from "@/lib/db/types";
import {
  TABELLONE_NOME,
  TABELLONE_SEGMENTO,
  parseTabelloneSegmento,
} from "@/lib/tappe/formato";
import type { ProblemaAvvio } from "./regole";

/** URL segment of a board, `m`, `f` or `x` (mixed). */
export const CATEGORIA_SEGMENTO: Record<CategoriaTabellone, string> =
  TABELLONE_SEGMENTO;

export const CATEGORIA_NOME: Record<CategoriaTabellone, string> =
  TABELLONE_NOME;

/** Accepts `m`/`f`/`x` (any case) from the URL. */
export function parseCategoriaSegmento(
  segmento: string,
): CategoriaTabellone | null {
  return parseTabelloneSegmento(segmento);
}

/** w-admin-avvio-fase of one board. */
export function avvioFasePath(
  tappaId: string,
  categoria: CategoriaTabellone,
): string {
  return `/admin/tappe/${encodeURIComponent(tappaId)}/avvio/${CATEGORIA_SEGMENTO[categoria]}`;
}

/**
 * The groups editor of one board (BLVS-28, w-admin-gironi), same path as
 * its `gironiEditorPath`.
 */
export function gironiPath(
  tappaId: string,
  categoria: CategoriaTabellone,
): string {
  return `/admin/tappe/${encodeURIComponent(tappaId)}/gironi/${CATEGORIA_SEGMENTO[categoria]}`;
}

/**
 * Where an error sends the admin to fix it: the group in the editor, or
 * the «Non assegnati» column for players out of every group.
 * TODO(BLVS-28): align the anchors with the ids the editor renders.
 */
export function linkProblema(
  tappaId: string,
  categoria: CategoriaTabellone,
  problema: ProblemaAvvio,
): string {
  const base = gironiPath(tappaId, categoria);
  if (problema.gironeId) {
    return `${base}#girone-${encodeURIComponent(problema.gironeId)}`;
  }
  return problema.regola === "non_assegnato" ? `${base}#non-assegnati` : base;
}
