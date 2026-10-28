import type {
  Categoria,
  FaseGioco,
  FaseGirone,
  FaseTabellone,
  StatoTappa,
} from "@/lib/db/types";
import type { LivelloGironi } from "@/lib/gironi/fasi/fase";

/*
 * w-tabellone (BLVS-48): the player's view of a stage's boards. These
 * types are also the payload of the `stage-board` live event, so they
 * import nothing from the live contract.
 */

/** The steps of a board, in order (R-30: always as text). */
export const PASSI_TABELLONE = [
  "iscrizioni",
  "gironi_iniziali",
  "gironi_gold_silver",
  "finali",
  "conclusa",
] as const;

export type FaseDelTabellonePasso = (typeof PASSI_TABELLONE)[number];

export type StatoPasso = "fatta" | "corrente" | "futura";

export type PassoFase = {
  fase: FaseDelTabellonePasso;
  label: string;
  stato: StatoPasso;
};

/**
 * The qualifying line of a group: players placed `dopo` or better are
 * «sopra» (they go on to `sopra`), the others «sotto».
 */
export type TaglioGirone = {
  dopo: number;
  sopra: string;
  sotto: string;
};

export type RigaTabellone = {
  /** Registration id (`iscrizioni.id`). */
  playerId: string;
  name: string;
  /** 1-based; null while the group has no concluded match. */
  position: number | null;
  /** In an open perfect tie: shown as «2=». */
  pari: boolean;
  /** BLVS-42: «Ritirato», «Assente in 1 partita». */
  note?: string;
  played: number;
  won: number;
  diff: number;
  points: number;
};

export type StatoGironeTabellone = "da_giocare" | "in_corso" | "completo";

export type GironeTabellone = {
  id: string;
  nome: string;
  fase: FaseGirone;
  livello: LivelloGironi;
  colore: FaseTabellone | null;
  stato: StatoGironeTabellone;
  taglio: TaglioGirone | null;
  rows: RigaTabellone[];
};

export type BoardTabellone = {
  categoria: Categoria;
  faseGioco: FaseGioco | null;
  conclusoIl: string | null;
  fase: FaseDelTabellonePasso;
  /** Every group of the board, by level then position. */
  gironi: GironeTabellone[];
};

/** Everything w-tabellone shows for one stage, both boards. */
export type StageBoard = {
  /** The stage id: one per stage. */
  id: string;
  stageId: string;
  /** The stage name, e.g. «Tappa 1 · Jesolo». */
  label: string;
  statoTappa: StatoTappa;
  boards: BoardTabellone[];
  /** What changed, e.g. «tabellone concluso»; null on a plain read. */
  change: string | null;
  /** ISO time the boards were read. */
  updatedAt: string;
};
