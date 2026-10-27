import type { Categoria } from "@/lib/db/types";

/**
 * Whether the player may change category (`public.stato_categoria()`):
 * `bloccata` after the first stage played, `iscrizione_attiva` while a
 * registration still points at the board of the current category.
 */
export const STATI_CATEGORIA = [
  "modificabile",
  "iscrizione_attiva",
  "bloccata",
] as const;
export type StatoCategoria = (typeof STATI_CATEGORIA)[number];

/** What the profile pages (w-profilo, w-profilo-modifica) show. */
export type Profilo = {
  nome: string;
  cognome: string;
  email: string;
  emailConfermata: boolean;
  /** New address waiting for confirmation; the old one stays active. */
  emailInAttesa: string | null;
  categoria: Categoria | null;
  statoCategoria: StatoCategoria;
};

export type ProfiloValori = {
  nome: string;
  cognome: string;
  email: string;
  categoria: Categoria | null;
};

export const CAMPI_PROFILO = ["nome", "cognome", "email", "categoria"] as const;
export type CampoProfilo = (typeof CAMPI_PROFILO)[number];

/** Result of `aggiornaProfilo`, the profile form's server action. */
export type ProfiloFormState =
  | { status: "idle" }
  | {
      status: "error";
      message: string;
      fields: Partial<Record<CampoProfilo, string>>;
    }
  | {
      status: "success";
      message: string;
      /** The values now saved: the form's new baseline. */
      values: ProfiloValori;
      /** Set when a confirmation link was sent to a new address. */
      emailInAttesa: string | null;
    }
  | { status: "sessionExpired"; message: string };

export const initialProfiloFormState: ProfiloFormState = { status: "idle" };

export type ProfiloAction = (
  prevState: ProfiloFormState,
  formData: FormData,
) => Promise<ProfiloFormState>;

export const PROFILO_PATH = "/profilo";
export const PROFILO_MODIFICA_PATH = "/profilo/modifica";

export const PROFILO_MESSAGES = {
  invalid: "Controlla i campi evidenziati.",
  saved: "Dati salvati.",
  sessionExpired:
    "La sessione è scaduta: accedi di nuovo per salvare le modifiche.",
  failed: "Salvataggio non riuscito. Riprova più tardi.",
  emailTaken: "Questa email è già usata da un altro account.",
  emailRateLimited:
    "Hai chiesto troppi cambi di email: riprova tra qualche minuto.",
  emailFailed:
    "Non siamo riusciti a inviare il link di conferma. Riprova più tardi.",
  categoria: {
    bloccata:
      "Hai già giocato una tappa: la categoria non si può più cambiare. Per correggerla scrivi all'organizzazione.",
    iscrizione_attiva:
      "Hai un'iscrizione attiva: per cambiare categoria ritirala prima, o scrivi all'organizzazione.",
  },
} as const;

/** «In attesa di conferma» text for a pending email change. */
export function emailInAttesaMessage(nuova: string, attuale: string): string {
  return `Abbiamo inviato un link di conferma a ${nuova} e uno a ${attuale}: apri entrambi per completare il cambio. Fino ad allora resta valida ${attuale}.`;
}
