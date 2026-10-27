import type { Categoria, StatoPartita } from "@/lib/db/types";

/** One set of a group match: points of team A and team B. */
export type SetPunteggio = { a: number; b: number };

/**
 * A score that regenerating the groups would delete: a group match of the
 * board with at least one set entered (RPC `punteggi_rigenerazione`).
 */
export type PunteggioPerso = {
  partitaId: string;
  /** «Girone A»…; null only for a match left without its group. */
  girone: string | null;
  turno: number;
  stato: StatoPartita;
  sets: SetPunteggio[];
  /** Full names of the two players of each team. */
  squadraA: string[];
  squadraB: string[];
};

/** Why a regeneration was refused; the UI picks copy and follow-up from it. */
export type MotivoRifiutoRigenerazione =
  | "conflict"
  | "invalid"
  | "notFound"
  | "permissionDenied"
  | "sessionExpired"
  | "network";

export type RigeneraState =
  | { status: "idle" }
  | {
      status: "success";
      persi: number;
      gironi: number;
      message: string;
      at: number;
    }
  | {
      /** The confirmation box was not ticked while scores would be lost. */
      status: "fieldErrors";
      fields: { conferma: string };
      at: number;
    }
  | {
      status: "error";
      reason: MotivoRifiutoRigenerazione;
      message: string;
      /**
       * With `conflict`: the scores that would be lost NOW, so the dialog
       * can show the fresh list and ask again.
       */
      punteggi?: PunteggioPerso[];
      at: number;
    };

export const initialRigeneraState: RigeneraState = { status: "idle" };

export type RigeneraAction = (
  prev: RigeneraState,
  formData: FormData,
) => Promise<RigeneraState>;

/** What the regeneration button needs to know about its board. */
export type RigenerazioneTabellone = {
  tappaId: string;
  categoria: Categoria;
  punteggi: PunteggioPerso[];
};

export const RIGENERA_MESSAGES = {
  sessionExpired: "La sessione è scaduta: accedi di nuovo per continuare.",
  permissionDenied: "Solo l'amministrazione può rigenerare i gironi.",
  notFound: "Tabellone non trovato: ricarica la pagina.",
  invalid: "Richiesta non valida: ricarica la pagina e riprova.",
  network:
    "Non è stato possibile rigenerare i gironi: controlla la connessione e riprova.",
  offline:
    "Sei offline: potrai rigenerare i gironi quando la connessione torna disponibile.",
  tappaArchiviata: "La tappa è archiviata: consultabile ma non modificabile.",
  tappaNonRigenerabile:
    "I gironi si rigenerano solo a iscrizioni chiuse o a tappa in corso.",
  tabelloneConcluso:
    "Il tabellone è concluso: i gironi non si possono più rigenerare.",
  faseSuccessiva:
    "La fase a eliminazione è già iniziata: i gironi non si possono più rigenerare.",
} as const;
