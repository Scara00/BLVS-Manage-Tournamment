import type { Categoria } from "@/lib/db/types";

/** One stage of a player in the overall standing. */
export type RisultatoTappa = {
  tappaId: string;
  /** Stage name, e.g. «Tappa 1 · Jesolo». */
  nome: string;
  /** `YYYY-MM-DD`: orders the stages for the «most recent» tie-break. */
  data: string;
  /** Place in the stage standing (BLVS-40), null when knocked out before the finals. */
  posizione: number | null;
  /** Points earned; 0 when knocked out before the finals. */
  punti: number;
  /** The board is still open (`tabelloni.concluso_il` unset). */
  provvisori: boolean;
};

/** The input of the sum: one player in one stage. */
export type PartecipazioneTappa = {
  utenteId: string;
  nome: string;
  risultato: RisultatoTappa;
};

export type RigaGenerale = {
  utenteId: string;
  nome: string;
  /** 1-based; players still level after every criterion share it. */
  posizione: number;
  punti: number;
  tappeGiocate: number;
  /** Some of the points can still change (a board not closed yet). */
  puntiProvvisori: boolean;
  /** Shares the place with another player (R-48). */
  pariMerito: boolean;
  /** Stages played, newest first. */
  tappe: readonly RisultatoTappa[];
};

export type ClassificaGenerale = {
  categoria: Categoria;
  /** The season shown, or null for every season. */
  stagione: number | null;
  righe: readonly RigaGenerale[];
};
