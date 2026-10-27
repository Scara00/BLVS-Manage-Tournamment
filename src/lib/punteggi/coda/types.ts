import type { SetPunteggio } from "@/lib/db/types";

/**
 * Where a queued score is (BLVS-33):
 * - `in_attesa`: on this device, waiting for the network or the next retry;
 * - `invio`: being sent right now;
 * - `salvato`: the server confirmed it;
 * - `sessione_chiusa`: the admin session closed (or another account is
 *   signed in): kept here, sent after the same admin signs in again;
 * - `conflitto`: another admin saved a different score in the meantime;
 *   the admin chooses which one to keep;
 * - `rifiutato`: the server refused it for good (match gone, stage
 *   archived): kept so the admin sees it, never sent again.
 */
export const STATI_VOCE = [
  "in_attesa",
  "invio",
  "salvato",
  "sessione_chiusa",
  "conflitto",
  "rifiutato",
] as const;
export type StatoVoce = (typeof STATI_VOCE)[number];

/** The score on the server, as an answer returns it. */
export type PunteggioServer = { sets: SetPunteggio[]; versione: number };

/** One score in the device queue (IndexedDB `blvs-coda` / `punteggi`). */
export type VoceCoda = {
  /** Generated once on the device: the server saves each key once. */
  chiave: string;
  partitaId: string;
  /** The score version the admin saw when entering it. */
  versione: number;
  sets: SetPunteggio[];
  /** «Girone A · turno 1»: how the queue names the match. */
  etichetta: string;
  /** Page where it was entered, for the link in the lists. */
  path: string;
  /** Admin who entered it; `null` when unknown. Only they send it. */
  autoreId: string | null;
  stato: StatoVoce;
  /** ISO times. */
  creataIl: string;
  aggiornataIl: string;
  tentativi: number;
  /** ISO time of the next automatic retry; `null` = at the next trigger. */
  prossimoTentativo: string | null;
  /** `conflitto`: the score another admin saved. */
  server?: PunteggioServer;
  /** `rifiutato`: why. */
  messaggio?: string;
};

/** What the page passes to queue a score. */
export type NuovoPunteggio = {
  partitaId: string;
  versione: number;
  sets: SetPunteggio[];
  etichetta: string;
  path: string;
};

/** What the server action receives. */
export type InvioPunteggio = {
  chiave: string;
  partitaId: string;
  versione: number;
  sets: SetPunteggio[];
  autoreId: string | null;
};

/** The answer of one send; `rete` is set by the client when fetch fails. */
export type EsitoInvio =
  | { status: "salvato"; punteggio: PunteggioServer; duplicato: boolean }
  | { status: "conflitto"; punteggio: PunteggioServer }
  | { status: "sessionExpired" }
  | { status: "altroAccount" }
  | { status: "rifiutato"; message: string }
  | { status: "errore" }
  | { status: "rete" };

export type InviaPunteggio = (invio: InvioPunteggio) => Promise<EsitoInvio>;

export const CODA_MESSAGES = {
  stato: {
    in_attesa: "In attesa di invio",
    invio: "In attesa di invio",
    salvato: "Salvato",
    sessione_chiusa: "Salvato qui, non ancora inviato",
    conflitto: "Da verificare: modificato da un altro admin",
    rifiutato: "Non inviato",
  } satisfies Record<StatoVoce, string>,
  rifiutato: {
    partita: "La partita non esiste più.",
    archiviata: "La tappa è archiviata: i punteggi non si modificano più.",
    sets: "Il punteggio non è valido.",
    generico: "Il server ha rifiutato il punteggio.",
  },
} as const;
