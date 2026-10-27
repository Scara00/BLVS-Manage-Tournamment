import type {
  Categoria,
  FaseGioco,
  FasePartita,
  SetPunteggio,
  StatoPartita,
  StatoTappa,
} from "@/lib/db/types";

export type GiocatorePartita = {
  iscrizioneId: string;
  nome: string;
  cognome: string;
};

/** One match of a board as w-admin-live shows it. */
export type PartitaLive = {
  id: string;
  fase: FasePartita;
  gironeId: string | null;
  gironeNome: string | null;
  /** `gironi.posizione`; 0 for a match without a group. */
  gironePosizione: number;
  turno: number;
  campo: string | null;
  programmataIl: string | null;
  stato: StatoPartita;
  squadraA: GiocatorePartita[];
  squadraB: GiocatorePartita[];
  sets: SetPunteggio[];
  /** `punteggi.versione` read with the sets: optimistic concurrency. */
  versione: number;
};

/** Everything w-admin-live reads for one board. */
export type TabelloneLive = {
  tappa: { id: string; nome: string; stato: StatoTappa };
  categoria: Categoria;
  faseGioco: FaseGioco | null;
  partite: PartitaLive[];
  /** ISO time the matches were read: the newer of this and a live event wins. */
  lettoIl: string;
};

/** `<stage id>:<M|F>`: the board's key on the live channel. */
export function chiaveTabellone(tappaId: string, categoria: Categoria): string {
  return `${tappaId}:${categoria}`;
}
