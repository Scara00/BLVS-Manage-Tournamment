import { testoNonAnnullabile, type MotivoNonAnnullabile } from "./regola";
import type { AnnullaIscrizioneState } from "./state";

type DbError = {
  code?: string;
  message?: string;
  hint?: string | null;
  details?: string | null;
};

export const ANNULLA_MESSAGES = {
  sessionExpired: "La sessione è scaduta: accedi di nuovo per annullare.",
  notFound: "Iscrizione non trovata: forse è già stata annullata.",
  nonAttiva: "Questa iscrizione è già stata annullata.",
  network:
    "Connessione assente o lenta: l'iscrizione non è stata annullata. Riprova.",
  unknown: "Annullamento non riuscito. Riprova tra poco.",
} as const;

const MOTIVI: readonly MotivoNonAnnullabile[] = [
  "non_attiva",
  "tappa_annullata",
  "tappa_iniziata",
  "scadenza_superata",
  "in_girone",
];

/** Maps an error of RPC `annulla_iscrizione()` onto the form state. */
export function statoDaErrore(
  error: DbError,
  attempt: number,
): AnnullaIscrizioneState {
  const motivo = MOTIVI.find((m) => m === error.hint);
  if (motivo) {
    const scadenza =
      motivo === "scadenza_superata" && error.details ? error.details : null;
    return {
      status: "error",
      reason: "refused",
      message:
        testoNonAnnullabile(motivo, scadenza) ?? ANNULLA_MESSAGES.nonAttiva,
      attempt,
    };
  }
  if (error.code === "P0002")
    return {
      status: "error",
      reason: "notFound",
      message: ANNULLA_MESSAGES.notFound,
      attempt,
    };
  if (error.code === "42501")
    return {
      status: "error",
      reason: "sessionExpired",
      message: ANNULLA_MESSAGES.sessionExpired,
      attempt,
    };
  console.error("[iscrizioni] annullamento non riuscito", error);
  return {
    status: "error",
    reason: "unknown",
    message: ANNULLA_MESSAGES.unknown,
    attempt,
  };
}
