import type {
  Categoria,
  FaseGioco,
  FaseGirone,
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
  /** `gironi.fase` (BLVS-39): initial, gold, silver or a final group. */
  gironeFase?: FaseGirone;
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
  /** `tabelloni.id` (`<stage>:<M|F>` in the demo). */
  tabelloneId: string;
  faseGioco: FaseGioco | null;
  /** BLVS-43: when the board was concluded; its points are then final. */
  conclusoIl: string | null;
  partite: PartitaLive[];
  /** ISO time the matches were read: the newer of this and a live event wins. */
  lettoIl: string;
};

/** `<stage id>:<M|F>`: the board's key on the live channel. */
export function chiaveTabellone(tappaId: string, categoria: Categoria): string {
  return `${tappaId}:${categoria}`;
}
