import type { LiveEvent } from "@/lib/live/types";
import { miaPosizione, type MeTabellone } from "./posizione";

function maiuscola(testo: string): string {
  return testo.charAt(0).toUpperCase() + testo.slice(1);
}

/**
 * The one short sentence w-tabellone says for an update (R-71): what
 * changed, then the player's place («Sei 2° in Girone A»). It never reads
 * the rows.
 */
export function annuncioTabellone(event: LiveEvent, me: MeTabellone): string {
  if (event.type !== "stage-board") return "";
  const { stage } = event;
  const testo = maiuscola(stage.change ?? "gironi aggiornati");
  const mia = miaPosizione(stage, me);
  if (mia?.stato !== "in_girone" || mia.riga.position === null) return testo;
  return `${testo}. Sei ${mia.posizione} in ${mia.girone.nome}`;
}

/** Only this stage's boards reach w-tabellone. */
export function eventoDelTabellone(event: LiveEvent, stageId: string): boolean {
  return event.type === "stage-board" && event.stage.stageId === stageId;
}
