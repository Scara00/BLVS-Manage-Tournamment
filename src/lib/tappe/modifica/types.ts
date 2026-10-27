import type { Categoria, StatoTappa } from "@/lib/db/types";

/** w-admin-tappa-modifica. */
export function tappaModificaPath(id: string): string {
  return `/admin/tappe/${encodeURIComponent(id)}/modifica`;
}

export const CAMPI_TAPPA_MODIFICA = [
  "nome",
  "luogo",
  "data",
  "scadenza",
  "postiM",
  "postiF",
] as const;
export type CampoTappaModifica = (typeof CAMPI_TAPPA_MODIFICA)[number];

export const CAMPO_POSTI_MODIFICA: Record<Categoria, "postiM" | "postiF"> = {
  M: "postiM",
  F: "postiF",
};

/** States in which a stage can no longer be edited from this screen. */
export const STATI_NON_MODIFICABILI: readonly StatoTappa[] = [
  "in_corso",
  "conclusa",
  "annullata",
];

export type TabelloneModifica = {
  /** Maximum number of players on the board. */
  posti: number;
  /** Active registrations (in attesa + confermate): the floor for `posti`. */
  iscritti: number;
};

/** A stage as the edit form loads it. */
export type TappaModifica = {
  id: string;
  nome: string;
  luogo: string;
  /** First day of play, `YYYY-MM-DD`. */
  data: string;
  /** Last day of play, `YYYY-MM-DD` (moves with `data`). */
  dataFine: string;
  /** Registration deadline as a Rome `datetime-local` value, or "". */
  scadenza: string;
  stato: StatoTappa;
  /** `tappe.versione` read with the data: sent back to detect conflicts. */
  versione: number;
  tabelloni: Record<Categoria, TabelloneModifica>;
};

/** What the form submits, already parsed. */
export type TappaModificaValori = {
  nome: string;
  luogo: string;
  data: string;
  /** ISO instant. */
  scadenza: string;
  postiM: number;
  postiF: number;
};

export type TappaModificaFieldErrors = Partial<
  Record<CampoTappaModifica, string>
>;

/**
 * Result of `aggiornaTappa`. `offline` never comes from the server: the
 * form sets it itself when the browser has no connection.
 */
export type TappaModificaFormState =
  | { status: "idle" }
  | { status: "error"; message: string; fields: TappaModificaFieldErrors }
  | {
      status: "conflict";
      message: string;
      /** The stage as it is saved now, with its newer version. */
      tappa: TappaModifica;
    }
  | { status: "success"; message: string; tappa: TappaModifica }
  | { status: "sessionExpired"; message: string }
  | { status: "permissionDenied"; message: string }
  | { status: "nonModificabile"; message: string }
  | { status: "unavailable"; message: string }
  | { status: "offline"; message: string };

export const initialTappaModificaFormState: TappaModificaFormState = {
  status: "idle",
};

export type TappaModificaAction = (
  prevState: TappaModificaFormState,
  formData: FormData,
) => Promise<TappaModificaFormState>;

/** «Il massimo non può scendere sotto N» (same text as the DB trigger). */
export function maxSottoIscrittiMessage(iscritti: number): string {
  return `Il massimo non può scendere sotto ${iscritti}`;
}

export const TAPPA_MODIFICA_MESSAGES = {
  invalid: "Controlla i campi evidenziati.",
  saved: "Modifiche salvate.",
  conflict:
    "Qualcun altro ha modificato questa tappa mentre la stavi modificando. Qui sotto trovi i dati aggiornati: controlla le tue modifiche e salva di nuovo.",
  sessionExpired:
    "La sessione è scaduta: accedi di nuovo per salvare. Le modifiche restano in bozza su questo dispositivo.",
  permissionDenied: "Solo l'amministrazione può modificare una tappa.",
  nonModificabile:
    "Questa tappa è in corso, conclusa o annullata: i suoi dati non si possono più modificare.",
  unavailable:
    "Salvataggio non disponibile: il database non è configurato in questo ambiente.",
  offline:
    "Sei offline: le modifiche restano in bozza su questo dispositivo. Salva di nuovo quando torna la connessione.",
  notFound: "Questa tappa non esiste più.",
  failed: "Salvataggio non riuscito. Riprova più tardi.",
  dataPassata: "La data della tappa deve essere futura.",
  scadenzaPassata: "La scadenza delle iscrizioni deve essere futura.",
  scadenzaDopoTappa: "La scadenza deve precedere la data della tappa.",
  scadenzaPrimaApertura:
    "La scadenza deve seguire l'apertura delle iscrizioni.",
  oraInesistente:
    "Quest'ora non esiste per il passaggio all'ora legale: scegline un'altra.",
  dataNonValida: "Data non valida.",
  scadenzaNonValida: "Data e ora non valide.",
} as const;
