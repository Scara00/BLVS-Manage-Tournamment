/**
 * Stage formats and board categories (mixed King & Queen). A classic stage
 * has two independent boards, M and F; a mixed one has a single X board
 * where every team is one man and one woman, and half the seats go to
 * each. Mirror of `tappe.formato` and of the `X` value of
 * `public.categoria` (migrations 20261102100000/100100).
 */
import type {
  Categoria,
  CategoriaTabellone,
  FormatoTappa,
} from "@/lib/db/types";
import { CATEGORIE_TABELLONE, FORMATI_TAPPA } from "@/lib/db/types";

/** The board in a sentence: «tabellone maschile», «tabellone misto». */
export const TABELLONE_NOME: Record<CategoriaTabellone, string> = {
  M: "maschile",
  F: "femminile",
  X: "misto",
};

/** The board as a label: «Maschile», «Misto». */
export const TABELLONE_LABEL: Record<CategoriaTabellone, string> = {
  M: "Maschile",
  F: "Femminile",
  X: "Misto",
};

/** URL segment of a board: `m`, `f`, `x`. */
export const TABELLONE_SEGMENTO: Record<CategoriaTabellone, string> = {
  M: "m",
  F: "f",
  X: "x",
};

export function isCategoriaTabellone(
  value: unknown,
): value is CategoriaTabellone {
  return (CATEGORIE_TABELLONE as readonly unknown[]).includes(value);
}

/** Accepts `m`/`f`/`x` (any case) from the URL. */
export function parseTabelloneSegmento(
  segmento: string,
): CategoriaTabellone | null {
  const valore = segmento.toUpperCase();
  return isCategoriaTabellone(valore) ? valore : null;
}

export function isFormatoTappa(value: unknown): value is FormatoTappa {
  return (FORMATI_TAPPA as readonly unknown[]).includes(value);
}

export const FORMATO_LABEL: Record<FormatoTappa, string> = {
  classico: "Classico",
  misto: "King & Queen misto",
};

export const FORMATO_DESCRIZIONE: Record<FormatoTappa, string> = {
  classico: "Due tabelloni indipendenti, maschile e femminile.",
  misto:
    "Un solo tabellone: ogni squadra è un uomo e una donna, metà posti a testa.",
};

/** The boards of a stage, in their order. */
export function categorieTabelloni(
  formato: FormatoTappa,
): CategoriaTabellone[] {
  return formato === "misto" ? ["X"] : ["M", "F"];
}

export function isTabelloneMisto(categoria: CategoriaTabellone): boolean {
  return categoria === "X";
}

/** A half of a mixed board: «uomini», «donne». */
export const QUOTA_NOME: Record<Categoria, string> = {
  M: "uomini",
  F: "donne",
};

/** «Posti uomini», «Posti donne». */
export const QUOTA_LABEL: Record<Categoria, string> = {
  M: "Posti uomini",
  F: "Posti donne",
};

/** «1 uomo e 3 donne», «2 uomini e 2 donne». */
export function uominiDonne(uomini: number, donne: number): string {
  return `${uomini} ${uomini === 1 ? "uomo" : "uomini"} e ${donne} ${donne === 1 ? "donna" : "donne"}`;
}

/** The seats of one half of a mixed board of `posti` seats. */
export function postiPerQuota(posti: number): number {
  return Math.floor(posti / 2);
}
