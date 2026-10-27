import { GIRONI_EDITOR_MESSAGES as M } from "./types";

type ErroreDb = { code?: string; hint?: string | null };

export type TipoErroreGironi =
  "conflict" | "bloccata" | "permissionDenied" | "notFound" | "failed";

/** How the editor reacts to an error of the groups RPCs. */
export function tipoErroreGironi(error: ErroreDb): TipoErroreGironi {
  if (error.code === "40001") return "conflict";
  if (error.code === "42501") return "permissionDenied";
  if (error.code === "P0002") return "notFound";
  if (error.code === "23514") {
    if (error.hint === "gironi_non_modificabili") return "bloccata";
    if (
      error.hint === "iscrizione_estranea" ||
      error.hint === "girone_estraneo"
    ) {
      return "notFound";
    }
  }
  return "failed";
}

export const MESSAGGIO_ERRORE_GIRONI: Record<TipoErroreGironi, string> = {
  conflict: M.conflict,
  bloccata: M.bloccata,
  permissionDenied: M.permissionDenied,
  notFound: M.notFound,
  failed: M.failed,
};
