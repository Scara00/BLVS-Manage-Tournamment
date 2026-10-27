/**
 * The partial score of a match in progress (BLVS-37, R-38). Pure: shared by
 * the form, the server action and the demo store. A partial is NOT a
 * result: ties are fine and the set rule does not apply, only whole
 * numbers 0..99 (the same typo guard as the score). The database repeats
 * the check in `public.salva_parziale()`.
 */
import type { SetPunteggio } from "@/lib/db/types";
import type { PunteggioUfficiale } from "./conflitto/rileva";
import type { PartitaPunteggio } from "./types";
import {
  type EsitoCampo,
  type Lato,
  leggiPunti,
  MESSAGGI_VALIDAZIONE,
} from "./validazione";

/** Whether the admin may send a partial for this match (R-38). */
export function accettaParziale(
  partita: Pick<PartitaPunteggio, "stato">,
  statoTappa: string,
): boolean {
  return statoTappa === "in_corso" && partita.stato === "in_corso";
}

export type ValidazioneParziale = {
  punti: Record<Lato, number | null>;
  campi: Partial<Record<Lato, string>>;
  esiti: Record<Lato, EsitoCampo>;
  valido: boolean;
};

/** Checks the two fields of a partial: both whole numbers 0..99. */
export function validaParziale(
  raw: Record<Lato, string>,
  { completo = true } = {},
): ValidazioneParziale {
  const punti = { a: leggiPunti(raw.a), b: leggiPunti(raw.b) };
  const campi: Partial<Record<Lato, string>> = {};
  const esiti: Record<Lato, EsitoCampo> = { a: "vuoto", b: "vuoto" };
  for (const lato of ["a", "b"] as const) {
    const n = punti[lato];
    if (n === null) {
      if (completo) {
        campi[lato] = MESSAGGI_VALIDAZIONE.mancante;
        esiti[lato] = "errore";
      }
    } else if (Number.isNaN(n)) {
      campi[lato] = MESSAGGI_VALIDAZIONE.nonValido;
      esiti[lato] = "errore";
    } else {
      esiti[lato] = "valido";
    }
  }
  return {
    punti,
    campi,
    esiti,
    valido: esiti.a === "valido" && esiti.b === "valido",
  };
}

/** The partial as the conflict dialog (BLVS-34) shows a score. */
export function parzialeComeUfficiale(
  parziale: {
    versione: number;
    a: number | null;
    b: number | null;
    autore: string | null;
    aggiornatoIl: string | null;
  } | null,
): PunteggioUfficiale {
  if (!parziale || parziale.a === null || parziale.b === null) {
    return {
      versione: parziale?.versione ?? 0,
      sets: [],
      autore: null,
      salvatoIl: null,
    };
  }
  return {
    versione: parziale.versione,
    sets: [{ a: parziale.a, b: parziale.b }],
    autore: parziale.autore,
    salvatoIl: parziale.aggiornatoIl,
  };
}

export type MotivoErroreParziale =
  "nonInCorso" | "sessionExpired" | "permissionDenied" | "network";

/** Result of `salvaParziale`; expected failures are values, never throws. */
export type ParzialeState =
  | { status: "idle" }
  | {
      status: "success";
      /** The partial's version after this update. */
      versione: number;
      punti: SetPunteggio;
      message: string;
      at: number;
    }
  | {
      status: "fieldErrors";
      campi: Partial<Record<Lato, string>>;
      message: string;
      at: number;
    }
  /** Another admin sent a partial first: nothing was written. */
  | {
      status: "conflict";
      salvato: PunteggioUfficiale;
      mio: SetPunteggio;
      message: string;
      at: number;
    }
  | {
      status: "error";
      reason: MotivoErroreParziale;
      message: string;
      at: number;
    };

export const initialParzialeState: ParzialeState = { status: "idle" };

export type SalvaParzialeAction = (
  prev: ParzialeState,
  formData: FormData,
) => Promise<ParzialeState>;

export const PARZIALE_MESSAGES = {
  inviato: "Parziale inviato ai giocatori",
  fieldErrors: "Il parziale non è valido: correggi i campi indicati.",
  conflitto:
    "Un altro admin ha inviato un parziale di questa partita prima di te.",
  tenuto: "Hai tenuto il parziale già inviato",
  nonInCorso:
    "Il parziale si invia solo per una partita in corso: avviala dalla gestione live.",
  sessionExpired: "La sessione è scaduta: accedi di nuovo per continuare.",
  permissionDenied: "Solo l'amministrazione può inviare il parziale.",
  network:
    "Non è stato possibile inviare il parziale: controlla la connessione e riprova.",
  offline:
    "Sei offline: potrai inviare il parziale quando la connessione torna.",
  fuoriClassifica: "Il parziale non entra in classifica.",
} as const;
