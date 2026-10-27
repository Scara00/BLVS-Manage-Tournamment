import "server-only";
import { getLiveBus } from "./bus";
import type {
  GroupStandings,
  LiveEvent,
  LiveMatch,
  OverallStandingRow,
} from "./types";

/*
 * Entry points for "a change was saved". Call them right after the write
 * commits (score entry, standings recalculation): every connected client
 * gets the event over /api/live/stream within the 5 s budget.
 */

export function publishScore(match: LiveMatch): LiveEvent {
  return getLiveBus().publish({ type: "score", match });
}

export function publishGroupStandings(group: GroupStandings): LiveEvent {
  return getLiveBus().publish({ type: "group-standings", group });
}

export function publishOverallStandings(
  rows: readonly OverallStandingRow[],
): LiveEvent {
  return getLiveBus().publish({ type: "overall-standings", rows });
}
