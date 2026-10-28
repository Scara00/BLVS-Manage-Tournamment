import "server-only";
import { getLiveBus } from "./bus";
import type {
  BoardClosed,
  BoardMatches,
  GroupStandings,
  LiveEvent,
  LiveMatch,
  OverallStandingRow,
  PendingScores,
  PhaseStarted,
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

/** New count of results to enter for a stage (admin dashboard banner). */
export function publishPendingScores(stage: PendingScores): LiveEvent {
  return getLiveBus().publish({ type: "pending-scores", stage });
}

/** A board's phase started and its matches were created (BLVS-29). */
export function publishPhaseStarted(phase: PhaseStarted): LiveEvent {
  return getLiveBus().publish({ type: "phase-started", phase });
}

/** An admin changed a match of a board: its whole list (BLVS-31). */
export function publishBoardMatches(board: BoardMatches): LiveEvent {
  return getLiveBus().publish({ type: "board-matches", board });
}

/** A board was concluded (BLVS-43): its points are final. */
export function publishBoardClosed(board: BoardClosed): LiveEvent {
  return getLiveBus().publish({ type: "board-closed", board });
}
