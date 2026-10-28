/**
 * Deleting a stage (admin): action state, copy and the confirmation check
 * shared by the dialog and the server action. A plain module, so client
 * components import it without touching the "use server" file.
 */
import { confermaValida, PAROLA_CONFERMA } from "@/lib/cancellazione/anonimo";

export { PAROLA_CONFERMA };

/** Why the deletion failed; the UI picks the copy and the follow-up. */
export type MotivoErroreEliminazione =
  | "invalid"
  | "conflict"
  | "permissionDenied"
  | "sessionExpired"
  | "network"
  | "unavailable";

export type EliminaTappaState =
  | { status: "idle" }
  | { status: "success"; message: string; at: number }
  | {
      status: "error";
      reason: MotivoErroreEliminazione;
      message: string;
      fields: { conferma?: string };
      at: number;
    };

export const initialEliminaTappaState: EliminaTappaState = { status: "idle" };

export type EliminaTappaAction = (
  prev: EliminaTappaState,
  formData: FormData,
) => Promise<EliminaTappaState>;

export const ELIMINAZIONE_MESSAGES = {
  confermaMancante: `Scrivi ${PAROLA_CONFERMA} per confermare.`,
  confermaErrata: `Per confermare scrivi esattamente ${PAROLA_CONFERMA}.`,
  invalid: "Controlla la conferma.",
  sessionExpired: "La sessione è scaduta: accedi di nuovo per continuare.",
  permissionDenied: "Solo l'amministrazione può eliminare una tappa.",
  conflict:
    "La tappa non c'è più: ricarica la pagina per vedere l'elenco aggiornato.",
  network:
    "Non è stato possibile eliminare la tappa: controlla la connessione e riprova.",
  offline:
    "Sei offline: potrai confermare quando la connessione torna disponibile.",
  unavailable:
    "Questa è una versione dimostrativa senza database: l'eliminazione non viene salvata.",
} as const;

/** The error for the typed confirmation, or `null` when it can be sent. */
export function erroreConferma(valore: string): string | null {
  if (confermaValida(valore)) return null;
  return valore.trim()
    ? ELIMINAZIONE_MESSAGES.confermaErrata
    : ELIMINAZIONE_MESSAGES.confermaMancante;
}

/** Toast after the deletion. */
export function messaggioEliminata(nome: string): string {
  return `Tappa «${nome}» eliminata.`;
}
