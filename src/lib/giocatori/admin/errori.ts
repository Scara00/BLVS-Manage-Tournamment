import type { ErroreCambio } from "./types";

export const CAMBIO_MESSAGES: Record<ErroreCambio, string> = {
  sessionExpired:
    "La sessione è scaduta: accedi di nuovo per cambiare la categoria.",
  permissionDenied: "Solo un admin può cambiare la categoria di un giocatore.",
  invalid: "Richiesta non valida: ricarica la pagina e riprova.",
  giocatoreNonTrovato:
    "Giocatore non trovato: forse l'account è stato cancellato.",
  stessaCategoria: "Il giocatore è già in questa categoria.",
  tappaInCorso:
    "Il giocatore è iscritto a una tappa in corso: la categoria si potrà cambiare a tappa conclusa.",
  effettiCambiati:
    "Nel frattempo gli effetti sono cambiati (iscrizioni o posti). Rileggi l'elenco aggiornato e conferma di nuovo.",
  network: "Cambio non riuscito per un problema di connessione. Riprova.",
};

type ErroreDb = {
  code?: string;
  hint?: string | null;
  details?: string | null;
};

/** The reason of a refusal of `admin_cambia_categoria`. */
export function erroreCambio(error: ErroreDb): ErroreCambio {
  if (error.code === "42501") return "permissionDenied";
  if (error.code === "40001" || error.hint === "effetti_cambiati") {
    return "effettiCambiati";
  }
  switch (error.hint) {
    case "giocatore_non_trovato":
      return "giocatoreNonTrovato";
    case "stessa_categoria":
      return "stessaCategoria";
    case "tappa_in_corso":
      return "tappaInCorso";
    case "categoria_mancante":
      return "invalid";
    default:
      return "network";
  }
}

/** The message, with the stage named when the database gives it. */
export function messaggioErrore(
  reason: ErroreCambio,
  dettaglio?: string | null,
) {
  if (reason === "tappaInCorso" && dettaglio) {
    return `Il giocatore è iscritto a ${dettaglio}, in corso: la categoria si potrà cambiare a tappa conclusa.`;
  }
  return CAMBIO_MESSAGES[reason];
}
