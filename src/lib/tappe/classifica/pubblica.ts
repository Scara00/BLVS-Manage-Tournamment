import "server-only";
import type { Categoria } from "@/lib/db/types";
import { getLiveBus } from "@/lib/live/bus";
import { publishStageStandings } from "@/lib/live/publish";
import { cambioClassificaTappa, idClassificaTappa } from "./live";
import { calcolaStageStandings, ultimaClassificaTappa } from "./read";

/**
 * Publishes one board's stage standing to w-classifica-tappa (BLVS-49)
 * after a change that can move it: a score saved, corrected or undone, a
 * tie decided, the finals created, a board closed. Call it after the
 * write commits. It compares with the last published standing: nothing
 * is sent when nothing changed, and the event says what did («punti
 * definitivi», «posizione definitiva per …»). Before the first publish
 * it compares with the last standing a page read, and always sends. It
 * never throws.
 */
export async function pubblicaClassificaTappa(
  tappaId: string,
  categoria: Categoria,
): Promise<void> {
  try {
    const id = idClassificaTappa(tappaId, categoria);
    const pubblicata = getLiveBus()
      .snapshot()
      .stageStandings?.find((s) => s.id === id);
    const letta = ultimaClassificaTappa(id);
    const dopo = await calcolaStageStandings(tappaId, categoria);
    if (!dopo) return;
    const change = pubblicata
      ? cambioClassificaTappa(pubblicata, dopo)
      : (cambioClassificaTappa(letta, dopo) ?? null);
    if (change === undefined) return;
    publishStageStandings({ ...dopo, change });
  } catch (error) {
    console.error("[classifica di tappa] pubblicazione non riuscita", error);
  }
}
