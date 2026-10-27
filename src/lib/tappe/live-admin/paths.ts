import type { Categoria } from "@/lib/db/types";
import { CATEGORIA_SEGMENTO } from "@/lib/tappe/avvio/paths";

/** w-admin-live of one board: matches in progress and phase progress. */
export function adminLivePath(tappaId: string, categoria: Categoria): string {
  return `/admin/tappe/${encodeURIComponent(tappaId)}/live/${CATEGORIA_SEGMENTO[categoria]}`;
}
