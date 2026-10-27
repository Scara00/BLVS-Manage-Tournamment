import type {
  Categoria,
  SetPunteggio,
  StatoPartita,
  StatoTappa,
} from "@/lib/db/types";

export type GiocatorePartita = {
  iscrizioneId: string;
  nome: string;
  cognome: string;
};

/**
 * The running score of a match in progress (BLVS-37): sent to the players
 * live, never part of the official score or the standings.
 */
export type ParzialePartita = {
  a: number;
  b: number;
  /** Own optimistic-concurrency counter (0 = none yet), not `punteggi`'s. */
  versione: number;
  /** ISO time of the last update. */
  aggiornatoIl: string;
};

/** One group match as the score screens see it. */
export type PartitaPunteggio = {
  id: string;
  categoria: Categoria;
  gironeId: string;
  gironeNome: string;
  turno: number;
  campo: string | null;
  stato: StatoPartita;
  sets: SetPunteggio[];
  /** `punteggi.versione`, sent back on save (optimistic concurrency). */
  versione: number;
  squadre: { a: GiocatorePartita[]; b: GiocatorePartita[] };
  /** BLVS-37: only while the match is `in_corso`; absent = none. */
  parziale?: ParzialePartita | null;
};

export type TappaPunteggi = {
  id: string;
  nome: string;
  stato: StatoTappa;
};

/** w-admin-live: every group match of a stage. */
export type ElencoPunteggi = {
  tappa: TappaPunteggi;
  partite: PartitaPunteggio[];
};

/** w-admin-punteggio: one match. */
export type SchedaPunteggio = {
  tappa: TappaPunteggi;
  partita: PartitaPunteggio;
  /**
   * BLVS-41: every match of the same group (this one included), so «Cosa
   * cambia» can recompute the standing with the corrected score.
   */
  girone?: PartitaPunteggio[];
};
