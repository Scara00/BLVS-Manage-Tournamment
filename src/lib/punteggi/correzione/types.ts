import type { SetPunteggio, StatoPartita } from "@/lib/db/types";

/** «Mantieni» keeps the next phase as it is, «Rigenera» redraws it. */
export type SceltaImpatto = "mantieni" | "rigenera";

export const SCELTE_IMPATTO: readonly SceltaImpatto[] = [
  "mantieni",
  "rigenera",
];

/**
 * A match of the board's next phase (BLVS-39), as the dialog shows it:
 * a gold/silver group match (`fase` gironi) or a final.
 */
export type PartitaFaseSuccessiva = {
  id: string;
  fase: "gironi" | "eliminazione" | "finale";
  /** The group's name («Gold A», «Finale gold»); absent without a group. */
  girone?: string | null;
  turno: number;
  stato: StatoPartita;
  sets: SetPunteggio[];
  /** Full names of the players of each team. */
  squadre: { a: string[]; b: string[] };
};

/**
 * What a group-score correction does to the next phase already generated
 * (w-admin-impatto-fase). `punteggiPersi` = its matches with a score,
 * which «Rigenera» deletes; the server refuses the save if it changed.
 */
export type ImpattoFase = {
  partite: PartitaFaseSuccessiva[];
  punteggiPersi: number;
};
