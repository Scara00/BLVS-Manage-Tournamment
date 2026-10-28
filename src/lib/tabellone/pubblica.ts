import "server-only";
import { publishStageBoard } from "@/lib/live/publish";
import { calcolaTabellone } from "./read";

/**
 * Publishes both boards of a stage to w-tabellone (BLVS-48) after any
 * change to its groups, results or phase: a score saved, corrected or
 * undone, a tie decided, a withdrawal, a phase started, a board closed.
 * Call it after the write commits. It never throws: a failed publish is
 * logged and the next page load (or resync) still reads fresh data.
 *
 * Already called from `pubblicaTabellone` (so every score and phase path)
 * and from `risolviParita`.
 */
export async function pubblicaGironiTappa(
  tappaId: string,
  cambio: string | null = null,
): Promise<void> {
  try {
    const stage = await calcolaTabellone(tappaId, cambio);
    if (stage) publishStageBoard(stage);
  } catch (error) {
    console.error("[tabellone] aggiornamento live non inviato", error);
  }
}
