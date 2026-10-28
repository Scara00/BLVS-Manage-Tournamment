import type { FaseGioco } from "@/lib/db/types";
import {
  FASE_TABELLONE_LABEL,
  faseDelTabellone,
  type LivelloGironi,
} from "@/lib/gironi/fasi/fase";
import {
  PASSI_TABELLONE,
  type FaseDelTabellonePasso,
  type PassoFase,
} from "./types";

/** The text of each step (R-30): the phase is never colour only. */
export const PASSO_LABEL: Record<FaseDelTabellonePasso, string> = {
  iscrizioni: "Iscrizioni",
  ...FASE_TABELLONE_LABEL,
};

/**
 * The current step of a board: «Iscrizioni» until its first phase starts
 * (registrations open or closed alike, client decision), then its game
 * phase, then «Conclusa» once BLVS-43 closed it (derived, never stored).
 */
export function faseCorrente(
  faseGioco: FaseGioco | null,
  conclusoIl: string | null,
): FaseDelTabellonePasso {
  return faseDelTabellone(faseGioco, conclusoIl) ?? "iscrizioni";
}

/** Every step of a board, marked done, current or still to come. */
export function passiFasi(corrente: FaseDelTabellonePasso): PassoFase[] {
  const indice = PASSI_TABELLONE.indexOf(corrente);
  return PASSI_TABELLONE.map((fase, i) => ({
    fase,
    label: PASSO_LABEL[fase],
    stato: i < indice ? "fatta" : i === indice ? "corrente" : "futura",
  }));
}

/**
 * The group level in play at each step: the one shown first. Before the
 * start the initial groups (if already drawn) are the ones to look at.
 */
export const LIVELLO_DELLA_FASE: Record<FaseDelTabellonePasso, LivelloGironi> =
  {
    iscrizioni: "iniziale",
    gironi_iniziali: "iniziale",
    gironi_gold_silver: "gold_silver",
    finali: "finali",
    conclusa: "finali",
  };

export const ORDINE_LIVELLI: readonly LivelloGironi[] = [
  "iniziale",
  "gold_silver",
  "finali",
];

/** «Gironi iniziali», «Gironi gold e silver», «Finali»: a level's title. */
export const LIVELLO_LABEL: Record<LivelloGironi, string> = {
  iniziale: "Gironi iniziali",
  gold_silver: "Gironi gold e silver",
  finali: "Finali",
};
