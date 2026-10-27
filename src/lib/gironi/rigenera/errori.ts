import {
  RIGENERA_MESSAGES as M,
  type MotivoRifiutoRigenerazione,
} from "./types";

type ErroreDb = { code?: string; hint?: string | null };

/**
 * Maps an error of RPC `rigenera_gironi()` onto a reason and a message.
 * `conferma_richiesta` and `punteggi_cambiati` both mean «the scores are
 * not the ones the admin saw»: the caller reloads them (`conflict`).
 */
export function rifiutoRigenerazione(error: ErroreDb): {
  reason: MotivoRifiutoRigenerazione;
  message: string;
} {
  switch (error.hint) {
    case "conferma_richiesta":
    case "punteggi_cambiati":
      return { reason: "conflict", message: "" };
    case "tappa_archiviata":
      return { reason: "invalid", message: M.tappaArchiviata };
    case "tappa_non_rigenerabile":
      return { reason: "invalid", message: M.tappaNonRigenerabile };
    case "tabellone_concluso":
      return { reason: "invalid", message: M.tabelloneConcluso };
    case "fase_successiva":
      return { reason: "invalid", message: M.faseSuccessiva };
  }
  switch (error.code) {
    case "42501":
      return { reason: "permissionDenied", message: M.permissionDenied };
    case "P0002":
      return { reason: "notFound", message: M.notFound };
    case "40001":
      return { reason: "conflict", message: "" };
    default:
      return { reason: "network", message: M.network };
  }
}
