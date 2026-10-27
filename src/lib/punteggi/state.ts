import type { SetPunteggio } from "@/lib/db/types";
import type { PunteggioUfficiale } from "./conflitto/rileva";
import type { ImpattoFase, SceltaImpatto } from "./correzione/types";
import type { Lato } from "./validazione";

export type MotivoErrore =
  | "conflict"
  | "nonGiocabile"
  | "annullamentoScaduto"
  | "sessionExpired"
  | "permissionDenied"
  | "network";

/** Result of `salvaPunteggio`; expected failures are values, never throws. */
export type PunteggioState =
  | { status: "idle" }
  | {
      status: "success";
      partitaId: string;
      /** Version after the save: «Annulla» sends it back. */
      versione: number;
      punteggio: SetPunteggio;
      /** «inserimento» or «correzione», as written in the registro. */
      tipo: "inserimento" | "correzione";
      /** BLVS-41: the choice made for the next phase, when it existed. */
      scelta?: SceltaImpatto | null;
      /** Next-phase scores deleted by «Rigenera». */
      punteggiPersi?: number;
      message: string;
      at: number;
    }
  /** The server refused the values (same checks as the form). */
  | {
      status: "fieldErrors";
      campi: Partial<Record<Lato, string>>;
      punteggio: string | null;
      message: string;
      at: number;
    }
  /**
   * BLVS-34: another admin saved first. Nothing was written: the dialog
   * shows the official score and the admin's own, and asks which to keep.
   */
  | {
      status: "conflict";
      salvato: PunteggioUfficiale;
      mio: SetPunteggio;
      message: string;
      at: number;
    }
  /**
   * BLVS-41: the board's next phase is already generated. Nothing was
   * written: the impact dialog asks «Mantieni» or «Rigenera», then the
   * admin's values are sent again with the choice.
   */
  | {
      status: "impatto";
      impatto: ImpattoFase;
      mio: SetPunteggio;
      /** The version the admin's values are based on. */
      versione: number;
      /** «Rigenera» refused without the tick: shown next to the box. */
      erroreConferma: string | null;
      /** Set when the next phase changed while the dialog was open. */
      avviso: string | null;
      message: string;
      at: number;
    }
  | {
      status: "error";
      reason: MotivoErrore;
      message: string;
      at: number;
    };

export const initialPunteggioState: PunteggioState = { status: "idle" };

export type SalvaPunteggioAction = (
  prev: PunteggioState,
  formData: FormData,
) => Promise<PunteggioState>;

export type AnnullaInput = {
  tappaId: string;
  partitaId: string;
  /** Version written by the save being undone. */
  versione: number;
};

export type AnnullaState =
  | { status: "success"; message: string }
  | { status: "error"; reason: MotivoErrore; message: string };

export type AnnullaPunteggioAction = (
  input: AnnullaInput,
) => Promise<AnnullaState>;

export const PUNTEGGIO_MESSAGES = {
  salvato: "Punteggio salvato",
  corretto: "Punteggio corretto",
  annullato: "Salvataggio annullato: il punteggio è tornato com'era.",
  fieldErrors: "Il punteggio non è valido: correggi i campi indicati.",
  conflict:
    "Il punteggio di questa partita è cambiato nel frattempo: ricarica la pagina per vedere quello attuale.",
  conflitto: "Un altro admin ha salvato questa partita prima di te.",
  impatto:
    "La fase successiva è già generata: scegli se mantenerla o rigenerarla.",
  tenuto: "Hai tenuto il punteggio salvato",
  nonGiocabile:
    "Questa partita non accetta punteggi: la tappa non è in corso o la partita è annullata.",
  annullamentoScaduto:
    "Non è più possibile annullare: correggi il punteggio dalla partita.",
  annullamentoCambiato:
    "Non è possibile annullare: il punteggio è stato modificato dopo il salvataggio.",
  sessionExpired: "La sessione è scaduta: accedi di nuovo per continuare.",
  permissionDenied: "Solo l'amministrazione può inserire i punteggi.",
  network:
    "Non è stato possibile salvare: controlla la connessione e riprova. I punti inseriti restano qui.",
  networkAnnulla:
    "Non è stato possibile annullare: controlla la connessione e riprova.",
  offline: "Sei offline: potrai salvare quando la connessione torna.",
} as const;
