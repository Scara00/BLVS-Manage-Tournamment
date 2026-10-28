import {
  classificaDaDati,
  toOverallStandings,
} from "@/lib/classifica-generale/dati";
import type { Categoria } from "@/lib/db/types";
import { getDemoDatiClassifica } from "@/lib/demo/classifica-generale";
import type { LiveSync, OverallStandings } from "@/lib/live/types";

/*
 * w-giocatore data for stories and tests: the demo overall standing
 * (BLVS-44 rules). 2026 has an open stage (provisional points), 2025 only
 * closed ones; M player 8 is a deleted account.
 */

export type DatiScheda = "provvisoria" | "definitiva";

export function standingsScheda(
  categoria: Categoria,
  dati: DatiScheda,
): OverallStandings {
  const stagione = dati === "provvisoria" ? 2026 : 2025;
  return toOverallStandings(
    classificaDaDati(
      getDemoDatiClassifica(categoria, stagione),
      categoria,
      stagione,
    ),
  );
}

export function syncScheda(standings: OverallStandings): LiveSync {
  return {
    snapshot: {
      seq: 0,
      updatedAt: "2026-07-18T10:05:00.000Z",
      matches: [],
      groups: [],
      overall: [],
      pendingScores: [],
      overallStandings: [standings],
    },
    syncedAt: "2026-07-18T10:30:00.000Z",
  };
}
