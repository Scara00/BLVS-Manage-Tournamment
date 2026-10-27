import type { SetPunteggio } from "@/lib/db/types";
import type { CambioPunti } from "@/lib/tappe/chiusura/punti";
import type { ErroriPunteggio } from "./punteggio";

/** What an admin can do to a match from w-admin-live. */
export const OPERAZIONI_PARTITA = ["inizia", "concludi"] as const;
export type OperazionePartita = (typeof OPERAZIONI_PARTITA)[number];

export type MotivoErrorePartita =
  "conflict" | "sessionExpired" | "permissionDenied" | "network";

/** Result of a match action; expected failures are values, never throws. */
export type AzionePartitaState =
  | { status: "idle" }
  | { status: "success"; partitaId: string; message: string; at: number }
  /** Score dialog: one message per set, keyed `set1`…, or `sets`. */
  | {
      status: "fieldErrors";
      errori: ErroriPunteggio;
      message: string;
      at: number;
    }
  | {
      status: "error";
      reason: MotivoErrorePartita;
      message: string;
      at: number;
    }
  /**
   * BLVS-43: a correction on a concluded board, nothing saved yet. The
   * dialog lists the points that change and asks for an explicit
   * confirmation, sent back with `firma` (points seen) and the sets.
   */
  | {
      status: "confermaConcluso";
      partitaId: string;
      sets: SetPunteggio[];
      cambi: CambioPunti[];
      firma: string;
      /** The points changed while the dialog was open. */
      avviso: string | null;
      message: string;
      at: number;
    };

export const initialAzionePartitaState: AzionePartitaState = {
  status: "idle",
};

export type AzionePartitaAction = (
  prev: AzionePartitaState,
  formData: FormData,
) => Promise<AzionePartitaState>;

export const LIVE_ADMIN_MESSAGES = {
  conflict:
    "Un altro amministratore ha appena cambiato questa partita: controlla lo stato aggiornato e riprova.",
  nonTrovata:
    "La partita non esiste più: ricarica la pagina per vedere le partite attuali.",
  senzaVincitore: "Per concludere serve un punteggio con una squadra vincente.",
  tappaChiusa:
    "La tappa è archiviata o annullata: le partite non si modificano più.",
  tabelloneConcluso:
    "Il tabellone è concluso: la correzione va confermata dopo aver visto i punti che cambiano.",
  confermaConcluso:
    "Il tabellone è concluso: conferma la correzione dopo aver controllato i punti che cambiano.",
  puntiCambiati:
    "I punti sono cambiati nel frattempo: controlla di nuovo cosa cambia prima di confermare.",
  correttoConcluso: "punteggio corretto su tabellone concluso",
  punteggioNonValido: "Il punteggio non è valido: correggi i set indicati.",
  sessionExpired: "La sessione è scaduta: accedi di nuovo per continuare.",
  permissionDenied: "Solo l'amministrazione può aggiornare le partite.",
  network: "Non è stato possibile salvare: controlla la connessione e riprova.",
  offline:
    "Sei offline: potrai aggiornare le partite quando la connessione torna.",
} as const;
