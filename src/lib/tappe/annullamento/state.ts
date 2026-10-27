/**
 * BLVS-22 · Cancelling and archiving a stage: action states, copy and the
 * pure checks shared by the dialog and the server actions. A plain module,
 * so client components import it without touching the "use server" file.
 */

/** Same limit as the `tappe_motivo_annullamento_lunghezza` CHECK. */
export const MOTIVO_MAX = 500;

/** Why an action failed; the UI picks the copy and the follow-up from it. */
export type MotivoErroreAnnullamento =
  | "invalid"
  | "conflict"
  | "permissionDenied"
  | "sessionExpired"
  | "network"
  | "unavailable";

export type AnnullaTappaState =
  | { status: "idle" }
  | {
      status: "success";
      message: string;
      /** Notices queued for the players. */
      avvisi: number;
      /** Notices that could not be queued (logged on the server). */
      nonAccodati: number;
      at: number;
    }
  | {
      status: "error";
      reason: MotivoErroreAnnullamento;
      message: string;
      fields: { motivo?: string };
      at: number;
    };

export const initialAnnullaTappaState: AnnullaTappaState = { status: "idle" };

export type ArchiviaTappaState =
  | { status: "idle" }
  | { status: "success"; message: string; at: number }
  | {
      status: "error";
      reason: MotivoErroreAnnullamento;
      message: string;
      at: number;
    };

export const initialArchiviaTappaState: ArchiviaTappaState = {
  status: "idle",
};

export type AnnullaTappaAction = (
  prev: AnnullaTappaState,
  formData: FormData,
) => Promise<AnnullaTappaState>;

export type ArchiviaTappaAction = (
  prev: ArchiviaTappaState,
  formData: FormData,
) => Promise<ArchiviaTappaState>;

export const ANNULLAMENTO_MESSAGES = {
  motivoMancante: "Indica il motivo dell'annullamento.",
  motivoLungo: `Il motivo può avere al massimo ${MOTIVO_MAX} caratteri.`,
  invalid: "Controlla il motivo indicato.",
  sessionExpired: "La sessione è scaduta: accedi di nuovo per continuare.",
  permissionDenied:
    "Solo l'amministrazione può annullare o archiviare una tappa.",
  conflict:
    "La tappa è cambiata nel frattempo: ricarica la pagina per vedere lo stato attuale.",
  nonAnnullabile: "Una tappa conclusa non si può annullare.",
  network: "Non è stato possibile salvare: controlla la connessione e riprova.",
  offline:
    "Sei offline: potrai confermare quando la connessione torna disponibile.",
  unavailable:
    "Questa è una versione dimostrativa senza database: l'annullamento non viene salvato.",
  archiviaNonDisponibile:
    "Potrai archiviare la tappa dopo la chiusura dei risultati di entrambi i tabelloni.",
  archiviaNota:
    "Sarà possibile archiviare la tappa dopo la chiusura dei risultati.",
  archiviata:
    "Tappa archiviata: resta consultabile ma non si può più modificare.",
  tappaAnnullata: "La tappa è annullata: non accetta nuove iscrizioni.",
  tappaArchiviata: "La tappa è archiviata: non accetta nuove iscrizioni.",
} as const;

/** The error for a typed reason, or `null` when it can be sent. */
export function erroreMotivo(value: string): string | null {
  const motivo = value.trim();
  if (!motivo) return ANNULLAMENTO_MESSAGES.motivoMancante;
  if (motivo.length > MOTIVO_MAX) return ANNULLAMENTO_MESSAGES.motivoLungo;
  return null;
}

/** Toast after the cancellation. */
export function messaggioAnnullata(avvisi: number, nonAccodati: number) {
  if (avvisi + nonAccodati === 0) {
    return "Tappa annullata. Non c'erano iscritti da avvisare.";
  }
  const inviati =
    avvisi === 1
      ? "Tappa annullata. 1 avviso è in partenza."
      : `Tappa annullata. ${avvisi} avvisi sono in partenza.`;
  if (nonAccodati === 0) return inviati;
  const mancanti =
    nonAccodati === 1
      ? "1 avviso non è stato accodato"
      : `${nonAccodati} avvisi non sono stati accodati`;
  return `${inviati} ${mancanti}: avvisa direttamente quegli iscritti.`;
}
