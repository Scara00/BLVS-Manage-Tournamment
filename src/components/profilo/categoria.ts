import type { Category } from "@/components/scoreboard";
import type { Categoria } from "@/lib/db/types";

/** `utenti.categoria` → the label used by `CategoryLabel`. */
export const CATEGORIA_LABEL: Record<Categoria, Category> = {
  M: "maschile",
  F: "femminile",
};

export const CATEGORIA_TESTO: Record<Categoria, string> = {
  M: "Maschile",
  F: "Femminile",
};
