/**
 * Score validation shared by the form (as you type) and the server action
 * (before the RPC), so both show the same messages. The database repeats
 * the same rule in `public.valida_punteggio()`.
 */
import { REGOLA_SET, type RegolaSet } from "./regola";

export type Lato = "a" | "b";

/** Highest score a field accepts; the rule has no cap, this is a typo guard. */
export const PUNTI_MASSIMI = 99;

/** Same codes as the hints of `valida_punteggio` / `salva_punteggio`. */
export type CodiceErrore = "valori_non_validi" | "pareggio" | "regola_set";

/** Text shown next to each field: ✓ valid, ! to fix, · still to enter. */
export type EsitoCampo = "valido" | "errore" | "vuoto";

export const SIMBOLO_ESITO: Record<EsitoCampo, string> = {
  valido: "✓",
  errore: "!",
  vuoto: "·",
};

export const ETICHETTA_ESITO: Record<EsitoCampo, string> = {
  valido: "valido",
  errore: "da correggere",
  vuoto: "da inserire",
};

export const MESSAGGI_VALIDAZIONE = {
  mancante: "Inserisci i punti.",
  nonValido: `Scrivi un numero intero da 0 a ${PUNTI_MASSIMI}, senza segni né decimali.`,
  pareggio: "Il pareggio non è ammesso: una coppia deve vincere il set.",
} as const;

/** Why a score breaks the set rule, in words an admin can act on. */
export function messaggioRegolaSet(
  a: number,
  b: number,
  regola: RegolaSet = REGOLA_SET,
): string {
  const vincente = Math.max(a, b);
  const perdente = Math.min(a, b);
  if (vincente < regola.punti) {
    return `Il set si chiude a ${regola.punti}: chi vince deve arrivare almeno a ${regola.punti} punti.`;
  }
  if (vincente === regola.punti) {
    return `A ${regola.punti} servono almeno ${regola.scarto} punti di scarto: con ${perdente} si va avanti (per esempio ${regola.punti + 1}–${regola.punti - 1}).`;
  }
  return `Oltre i ${regola.punti} il set finisce con esattamente ${regola.scarto} punti di scarto (per esempio ${vincente}–${vincente - regola.scarto}).`;
}

/**
 * The rule on two whole numbers, as `public.valida_punteggio(a, b)`:
 * null when the score is valid, otherwise the error code.
 */
export function codiceErrore(
  a: number,
  b: number,
  regola: RegolaSet = REGOLA_SET,
): CodiceErrore | null {
  const valido = (n: number) =>
    Number.isInteger(n) && n >= 0 && n <= PUNTI_MASSIMI;
  if (!valido(a) || !valido(b)) return "valori_non_validi";
  if (a === b) return "pareggio";
  const vincente = Math.max(a, b);
  const scarto = vincente - Math.min(a, b);
  if (vincente === regola.punti && scarto >= regola.scarto) return null;
  if (vincente > regola.punti && scarto === regola.scarto) return null;
  return "regola_set";
}

/** A field's text: null when empty, NaN when not a whole number ≥ 0. */
export function leggiPunti(raw: string): number | null {
  const testo = raw.trim();
  if (testo === "") return null;
  if (!/^\d{1,3}$/.test(testo)) return Number.NaN;
  const n = Number(testo);
  return n > PUNTI_MASSIMI ? Number.NaN : n;
}

export type ValidazionePunteggio = {
  /** Parsed values; null = empty, NaN = not a valid number. */
  punti: Record<Lato, number | null>;
  /** Per-field problems (empty, not a number). */
  campi: Partial<Record<Lato, string>>;
  /** Problem of the score as a whole (tie, set rule), on both fields. */
  punteggio: string | null;
  codice: CodiceErrore | "mancante" | null;
  esiti: Record<Lato, EsitoCampo>;
  vincitore: Lato | null;
  valido: boolean;
};

/**
 * Checks the two fields. With `completo: false` (while typing) an empty
 * field is just «da inserire», not an error.
 */
export function validaPunteggio(
  raw: Record<Lato, string>,
  { completo = true, regola = REGOLA_SET } = {},
): ValidazionePunteggio {
  const punti = { a: leggiPunti(raw.a), b: leggiPunti(raw.b) };
  const campi: Partial<Record<Lato, string>> = {};
  const esiti: Record<Lato, EsitoCampo> = { a: "vuoto", b: "vuoto" };
  let codice: ValidazionePunteggio["codice"] = null;

  for (const lato of ["a", "b"] as const) {
    const n = punti[lato];
    if (n === null) {
      if (completo) {
        campi[lato] = MESSAGGI_VALIDAZIONE.mancante;
        esiti[lato] = "errore";
        codice ??= "mancante";
      }
    } else if (Number.isNaN(n)) {
      campi[lato] = MESSAGGI_VALIDAZIONE.nonValido;
      esiti[lato] = "errore";
      codice = "valori_non_validi";
    }
  }

  const a = punti.a;
  const b = punti.b;
  let punteggio: string | null = null;
  let vincitore: Lato | null = null;
  if (
    Object.keys(campi).length === 0 &&
    a !== null &&
    b !== null &&
    !Number.isNaN(a) &&
    !Number.isNaN(b)
  ) {
    const errore = codiceErrore(a, b, regola);
    if (errore === "pareggio") punteggio = MESSAGGI_VALIDAZIONE.pareggio;
    else if (errore === "regola_set") {
      punteggio = messaggioRegolaSet(a, b, regola);
    } else if (errore === "valori_non_validi") {
      punteggio = MESSAGGI_VALIDAZIONE.nonValido;
    }
    if (errore) {
      codice = errore;
      esiti.a = "errore";
      esiti.b = "errore";
    } else {
      esiti.a = "valido";
      esiti.b = "valido";
      vincitore = a > b ? "a" : "b";
    }
  }

  return {
    punti,
    campi,
    punteggio,
    codice,
    esiti,
    vincitore,
    valido: codice === null && vincitore !== null,
  };
}

/** The message the server shows for a hint of `salva_punteggio`. */
export function messaggioCodice(
  codice: CodiceErrore,
  a: number,
  b: number,
): string {
  switch (codice) {
    case "pareggio":
      return MESSAGGI_VALIDAZIONE.pareggio;
    case "regola_set":
      return messaggioRegolaSet(a, b);
    default:
      return MESSAGGI_VALIDAZIONE.nonValido;
  }
}
