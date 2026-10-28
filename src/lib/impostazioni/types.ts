import { PAROLA_CONFERMA } from "@/lib/cancellazione/anonimo";
import type { AnteprimaCancellazione } from "@/lib/cancellazione/anteprima";
import type { Categoria } from "@/lib/db/types";

/** w-impostazioni. */
export const IMPOSTAZIONI_PATH = "/impostazioni";
/** w-elimina-account: before/after and the confirmation. */
export const ELIMINA_ACCOUNT_PATH = "/impostazioni/elimina-account";
/** w-account-eliminato: public, the account no longer exists. */
export const ACCOUNT_CANCELLATO_PATH = "/account-cancellato";

/** The privacy consent given at sign-up (`public.consensi`, latest row). */
export type ConsensoPrivacy = {
  /** `versione_informativa`, e.g. «1.0». */
  versione: string;
  /** YYYY-MM-DD the accepted text applies from; null on older rows. */
  dataInformativa: string | null;
  /** ISO timestamp of the consent (`created_at`). */
  accettatoIl: string;
};

/** The player's row in the overall standing, now and after a deletion. */
export type RigaPubblica = AnteprimaCancellazione & {
  categoria: Categoria;
  stagione: number;
};

/** What w-impostazioni and w-elimina-account show. */
export type Impostazioni = {
  nome: string;
  cognome: string;
  email: string;
  consenso: ConsensoPrivacy | null;
  /** Null when the player is in no overall standing yet. */
  riga: RigaPubblica | null;
};

export type CampoPassword = "attuale" | "password" | "conferma";

/** Result of `cambiaPassword`. */
export type CambioPasswordState =
  | { status: "idle" }
  | {
      status: "error";
      message: string;
      fields: Partial<Record<CampoPassword, string>>;
    }
  | { status: "success"; message: string }
  | { status: "sessionExpired"; message: string };

export type CambioPasswordAction = (
  prev: CambioPasswordState,
  formData: FormData,
) => Promise<CambioPasswordState>;

export const initialCambioPasswordState: CambioPasswordState = {
  status: "idle",
};

/** Result of `cancellaAccount` (on success it redirects instead). */
export type CancellazioneState =
  | { status: "idle" }
  | {
      status: "error";
      message: string;
      fields: Partial<Record<"conferma", string>>;
    }
  | { status: "sessionExpired"; message: string };

export type CancellazioneAction = (
  prev: CancellazioneState,
  formData: FormData,
) => Promise<CancellazioneState>;

export const initialCancellazioneState: CancellazioneState = { status: "idle" };

export const IMPOSTAZIONI_MESSAGES = {
  invalid: "Controlla i campi evidenziati.",
  sessionExpired: "La sessione è scaduta: accedi di nuovo per continuare.",
  rateLimited: "Troppi tentativi. Riprova tra qualche minuto.",
  unavailable: "Servizio momentaneamente non disponibile. Riprova.",
  attualeMancante: "Inserisci la password attuale.",
  attualeErrata: "La password attuale non è corretta.",
  passwordFallita: "Non siamo riusciti a cambiare la password. Riprova.",
  confermaMancante: `Scrivi ${PAROLA_CONFERMA} per confermare.`,
  confermaErrata: `Per confermare scrivi esattamente ${PAROLA_CONFERMA}.`,
  accountAdmin:
    "Un account dell'organizzazione non si cancella da qui: chiedi a un altro admin di toglierti il ruolo.",
  tappaInCorso:
    "Hai una tappa in corso: potrai cancellare l'account quando sarà finita.",
  cancellazioneFallita:
    "Non siamo riusciti a cancellare l'account. Non è cambiato nulla: riprova.",
} as const;
