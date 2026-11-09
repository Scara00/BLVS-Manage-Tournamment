import type {
  Categoria,
  CategoriaTabellone,
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
  /** Mixed board only: men and women are ranked apart. */
  categoria?: Categoria;
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
  /**
   * On the mixed board: two matches per turn, so the description names the
   * teams. Absent = a classic board.
   */
  misto?: boolean;
};

/** Everything w-admin-live reads for one board. */
export type TabelloneLive = {
  /** `stato` is the playing state: a test draft plays as in progress. */
  tappa: { id: string; nome: string; stato: StatoTappa; prova?: boolean };
  categoria: CategoriaTabellone;
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
export function chiaveTabellone(
  tappaId: string,
  categoria: CategoriaTabellone,
): string {
  return `${tappaId}:${categoria}`;
}
