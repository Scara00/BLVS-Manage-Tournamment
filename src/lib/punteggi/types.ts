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
};
