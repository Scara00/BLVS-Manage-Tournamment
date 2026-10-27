import type { Categoria } from "@/lib/db/types";
import type { CriterioSpareggio } from "@/lib/gironi/classifica";

/** A tied player, by registration (one registration is one player). */
export type GiocatorePari = {
  iscrizioneId: string;
  /** «Nome Cognome», never truncated. */
  nome: string;
};

/** One tie-break criterion and the value each tied player has in it. */
export type CriterioPari = {
  id: CriterioSpareggio;
  etichetta: string;
  spiegazione: string;
  valori: { iscrizioneId: string; valore: number }[];
};

/** A perfect tie of a finished group, as w-admin-parita shows it. */
export type ParitaVista = {
  /** `ParitaPerfetta.firma`: the decision applies only while it matches. */
  firma: string;
  /** 1-based place the tied players share. */
  posizione: number;
  /** The admin's order when decided, otherwise the standing's order. */
  giocatori: GiocatorePari[];
  criteri: CriterioPari[];
  /** The stored decision for this very tie, or null while it is open. */
  decisione: { motivo: string } | null;
};

/** The ties of one group; empty while the group is still being played. */
export type ParitaGirone = {
  tappaId: string;
  categoria: Categoria;
  gironeId: string;
  gironeNome: string;
  parita: ParitaVista[];
};

/** Preset reasons for a decision; «Altro» needs the free text. */
export const MOTIVI_PARITA = [
  { id: "sorteggio", etichetta: "Sorteggio" },
  { id: "accordo", etichetta: "Accordo tra i giocatori" },
  { id: "spareggio", etichetta: "Spareggio giocato in campo" },
  { id: "altro", etichetta: "Altro" },
] as const;

export type MotivoParita = (typeof MOTIVI_PARITA)[number]["id"];

/** The free text adds to a preset, so the stored reason stays ≤ 500. */
export const NOTE_PARITA_MAX = 400;

export type CampiParita = {
  motivo?: string;
  note?: string;
  ordine?: string;
};

export type MotivoRifiutoParita =
  | "conflict"
  | "invalid"
  | "notFound"
  | "permissionDenied"
  | "sessionExpired"
  | "network";

export type RisolviParitaState =
  | { status: "idle" }
  | {
      status: "success";
      /** The new order, announced as text («Girone A: ordine deciso…»). */
      message: string;
      firma: string;
      at: number;
    }
  | { status: "fieldErrors"; fields: CampiParita; at: number }
  | {
      status: "error";
      reason: MotivoRifiutoParita;
      message: string;
      at: number;
    };

export const initialRisolviParitaState: RisolviParitaState = {
  status: "idle",
};

export type RisolviParitaAction = (
  prev: RisolviParitaState,
  formData: FormData,
) => Promise<RisolviParitaState>;

export const PARITA_MESSAGES = {
  motivoMancante: "Scegli come è stata decisa la parità.",
  noteMancanti: "Scrivi come è stata decisa la parità.",
  noteLunghe: `Il dettaglio può avere al massimo ${NOTE_PARITA_MAX} caratteri.`,
  ordineNonValido: "L'ordine deve elencare una volta ciascun giocatore pari.",
  conflict:
    "La classifica del girone è cambiata nel frattempo: ricarica la pagina e controlla di nuovo la parità.",
  notFound: "Girone non trovato: ricarica la pagina.",
  invalid: "Richiesta non valida: ricarica la pagina e riprova.",
  permissionDenied: "Solo l'organizzazione può decidere una parità.",
  sessionExpired: "La sessione è scaduta: accedi di nuovo per continuare.",
  network:
    "Non è stato possibile salvare la decisione: controlla la connessione e riprova.",
  offline:
    "Sei offline: potrai decidere l'ordine quando la connessione torna disponibile.",
} as const;
