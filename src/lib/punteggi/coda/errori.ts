import { CODA_MESSAGES as M, type EsitoInvio } from "./types";

type ErroreDb = { code?: string; hint?: string | null };

/**
 * What a refusal of `salva_punteggio_coda` means for the queue. The
 * conflict carries no score here: the action reads it afterwards.
 */
export function esitoErroreSalvataggio(
  error: ErroreDb,
): Exclude<EsitoInvio, { status: "conflitto" }> | { status: "conflitto" } {
  if (error.code === "40001") return { status: "conflitto" };
  if (error.code === "42501") return { status: "altroAccount" };
  if (error.code === "P0002")
    return { status: "rifiutato", message: M.rifiutato.partita };
  if (error.code === "23514") {
    switch (error.hint) {
      case "tappa_archiviata":
        return { status: "rifiutato", message: M.rifiutato.archiviata };
      case "sets_non_validi":
        return { status: "rifiutato", message: M.rifiutato.sets };
      default:
        return { status: "rifiutato", message: M.rifiutato.generico };
    }
  }
  return { status: "errore" };
}
