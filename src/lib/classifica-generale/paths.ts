import type { Categoria } from "@/lib/db/types";
import { CLASSIFICA_PATH } from "@/lib/navigation/auth-paths";

/**
 * A player's card (w-giocatore, BLVS-50) in one category and season.
 * Public like w-classifica: it sits under `/classifica`.
 */
export function giocatoreHref(
  utenteId: string,
  categoria: Categoria,
  stagione: number | null,
): string {
  const params = new URLSearchParams({ categoria });
  if (stagione !== null) params.set("stagione", String(stagione));
  return `${CLASSIFICA_PATH}/giocatore/${encodeURIComponent(utenteId)}?${params}`;
}
