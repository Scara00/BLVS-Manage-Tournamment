import type { Categoria } from "@/lib/db/types";
import type { StageBoard } from "@/lib/tabellone/types";
import type { PartitaLive } from "@/lib/tappe/live-admin/types";

/**
 * Shapes carried by the live channel (scores, group standings, overall
 * standings). Shared by the server bus, the SSE route and the client.
 */

export type SetScore = readonly [home: number, away: number];

/** One player of a King/Queen team; `id` is the registration id. */
export type LivePlayer = { id: string; name: string };

/** Match state, as `partite.stato`. */
export type LiveMatchState =
  "programmata" | "in_corso" | "conclusa" | "annullata";

/**
 * The running score of a match in progress (BLVS-37): shown live, never
 * in `sets` and never in any standing.
 */
export type LivePartial = {
  home: number;
  away: number;
  /** ISO time the admin sent it. */
  updatedAt: string;
};

export type LiveMatch = {
  id: string;
  court: string;
  groupId: string;
  /** Spoken in announcements, e.g. «Girone A». */
  groupLabel: string;
  home: string;
  away: string;
  sets: readonly SetScore[];
  /*
   * BLVS-36: optional, so older publishers stay valid. The player live
   * screen (w-live) needs them to find the stage, the player's own match
   * and the Gold/Silver board.
   */
  stageId?: string;
  category?: "M" | "F";
  /** Round of the group (1..3), orders a player's matches. */
  round?: number;
  state?: LiveMatchState;
  /** Full names of both teams, home first. */
  players?: { home: readonly LivePlayer[]; away: readonly LivePlayer[] };
  /** BLVS-37: the partial while `state` is `in_corso`; null = none. */
  partial?: LivePartial | null;
};

export type GroupStandingRow = {
  position: number;
  /** A pair, or one player in King/Queen standings. */
  pair: string;
  /** Registration id of the player (King/Queen standings, BLVS-36). */
  playerId?: string;
  /**
   * BLVS-42: a withdrawal or absence, as text («Ritirato», «Assente in 1
   * partita»); the matches it voided no longer count.
   */
  note?: string;
  played: number;
  won: number;
  /** Points scored (PF). */
  points: number;
  /** BLVS-47: points conceded (PS); optional for older publishers. */
  against?: number;
  /** BLVS-47: points scored minus conceded (Diff). */
  diff?: number;
};

export type GroupStandings = {
  id: string;
  label: string;
  /** BLVS-36: the stage and board of the group, when known. */
  stageId?: string;
  category?: "M" | "F";
  rows: readonly GroupStandingRow[];
};

export type OverallStandingRow = {
  position: number;
  pair: string;
  stages: number;
  points: number;
};

/** One player of the overall standing (BLVS-44, w-classifica). */
export type OverallPlayerRow = {
  /** `utenti.id`: the same player across stages. */
  playerId: string;
  name: string;
  /** Players level after every tie-break share it. */
  position: number;
  points: number;
  stages: number;
  /** Some points can still change: a board is not closed yet. */
  provisional: boolean;
  /** Shares the position with another player. */
  tied: boolean;
};

/** The overall standing of one category and season (BLVS-44). */
export type OverallStandings = {
  /** `<M|F>:<season>`, or `<M|F>:tutte` for every season. */
  id: string;
  category: Categoria;
  season: number | null;
  rows: readonly OverallPlayerRow[];
  /** What changed, said once by the announcer (e.g. «Tappa 2: punti definitivi»). */
  change?: string | null;
};

/** Results still to enter for a stage raced today (admin banner). */
export type PendingScores = {
  /** Stage id. */
  id: string;
  /** Stage name, spoken in announcements. */
  label: string;
  count: number;
};

/**
 * A board started a game phase (BLVS-29), or moved on to the gold/silver
 * groups or the finals (BLVS-39): its matches now exist.
 */
export type PhaseStarted = {
  /** `<stage id>:<category>`, one per board. */
  id: string;
  stageId: string;
  /** Spoken in announcements, e.g. «Tappa 3 · Cagliari, maschile». */
  label: string;
  category: "M" | "F";
  phase: "gironi_iniziali" | "gironi_gold_silver" | "finali";
  /** Matches created, all still to play. */
  matches: number;
};

/**
 * Every match of one board after an admin changed one (BLVS-31): the
 * other admins' w-admin-live redraws from it.
 */
export type BoardMatches = {
  /** `<stage id>:<category>`, one per board. */
  id: string;
  stageId: string;
  category: Categoria;
  /** Spoken in announcements, e.g. «Tappa 1 · Jesolo, maschile». */
  label: string;
  /** What changed, e.g. «Girone A · turno 2: partita conclusa». */
  change: string | null;
  /** ISO time the matches were read after the write. */
  updatedAt: string;
  matches: readonly PartitaLive[];
};

/** A board's definitive points, as the live channel carries them. */
export type BoardClosedPoints = {
  /** Registration id (`iscrizioni.id`). */
  playerId: string;
  name: string;
  /** Place in the category standing. */
  position: number;
  points: number | null;
};

/**
 * An admin concluded a board (BLVS-43): its points are final and the
 * overall standing updates.
 */
export type BoardClosed = {
  /** `<stage id>:<category>`, one per board. */
  id: string;
  stageId: string;
  category: Categoria;
  /** Spoken in announcements, e.g. «Tappa 1 · Jesolo, maschile». */
  label: string;
  /** ISO time the board was closed. */
  closedAt: string;
  /** Both boards are closed: the stage is concluded. */
  stageConcluded: boolean;
  points: readonly BoardClosedPoints[];
};

/** One player of a stage standing (BLVS-49, w-classifica-tappa). */
export type StageStandingRow = {
  /** Registration id (`iscrizioni.id`). */
  playerId: string;
  name: string;
  /** The final the player is in; null while unknown. */
  phase: "gold" | "silver" | null;
  /** Place in the category standing; tied players share it. */
  position: number;
  /** Place inside the final, which sets the points. */
  phasePosition: number;
  /** Points of that place; null while the final's phase is unknown. */
  points: number | null;
  /** The place can no longer change. */
  definitive: boolean;
  /** In a perfect tie the admin has not resolved yet. */
  toResolve: boolean;
  withdrawn: boolean;
};

/** The stage standing of one board, gold final then silver (BLVS-49). */
export type StageStandings = {
  /** `<stage id>:<category>`, one per board. */
  id: string;
  stageId: string;
  category: Categoria;
  /** Spoken in announcements, e.g. «Tappa 1 · Jesolo, maschile». */
  label: string;
  state: "in_attesa" | "in_corso" | "definitiva" | "conclusa";
  /** True until the board is closed (BLVS-43). */
  provisional: boolean;
  rows: readonly StageStandingRow[];
  /** What changed, said once by the announcer (e.g. «punti definitivi»). */
  change?: string | null;
};

export type LiveSnapshot = {
  /** Sequence number of the last event folded into this snapshot. */
  seq: number;
  /** ISO time of the last change (or of the seed). */
  updatedAt: string;
  matches: readonly LiveMatch[];
  groups: readonly GroupStandings[];
  overall: readonly OverallStandingRow[];
  /** Per category and season; absent in snapshots from before BLVS-44. */
  overallStandings?: readonly OverallStandings[];
  /** Per stage, only for the stages that published a count. */
  pendingScores: readonly PendingScores[];
  /** Boards whose phase started; absent in snapshots from before BLVS-29. */
  phases?: readonly PhaseStarted[];
  /** Boards an admin changed; absent in snapshots from before BLVS-31. */
  boards?: readonly BoardMatches[];
  /** Boards an admin concluded; absent in snapshots from before BLVS-43. */
  closed?: readonly BoardClosed[];
  /** BLVS-48: both boards of a stage for w-tabellone, one per stage. */
  stageBoards?: readonly StageBoard[];
  /** Per board; absent in snapshots from before BLVS-49. */
  stageStandings?: readonly StageStandings[];
};

/** Snapshot plus the server time it was read: the client's resync payload. */
export type LiveSync = { snapshot: LiveSnapshot; syncedAt: string };

export type LiveEventPayload =
  | { type: "score"; match: LiveMatch }
  | { type: "group-standings"; group: GroupStandings }
  | {
      type: "overall-standings";
      rows: readonly OverallStandingRow[];
      /** BLVS-44: the standing of one category and season. */
      standings?: OverallStandings;
    }
  | { type: "pending-scores"; stage: PendingScores }
  | { type: "phase-started"; phase: PhaseStarted }
  | { type: "board-matches"; board: BoardMatches }
  | { type: "board-closed"; board: BoardClosed }
  | { type: "stage-board"; stage: StageBoard }
  | { type: "stage-standings"; standings: StageStandings };

export type LiveEvent = LiveEventPayload & {
  /** Monotonic per server: the SSE `id`, used for dedupe and replay. */
  seq: number;
  /** ISO time the change was saved, from the server clock. */
  savedAt: string;
};

export const LIVE_EVENT_TYPES = [
  "score",
  "group-standings",
  "overall-standings",
  "pending-scores",
  "phase-started",
  "board-matches",
  "board-closed",
  "stage-board",
  "stage-standings",
] as const satisfies readonly LiveEvent["type"][];

function upsert<T extends { id: string }>(list: readonly T[], item: T): T[] {
  const index = list.findIndex((x) => x.id === item.id);
  if (index === -1) return [...list, item];
  return list.map((x, i) => (i === index ? item : x));
}

/** Folds one event into a snapshot. Pure: used by the bus and the client. */
export function applyLiveEvent(
  snapshot: LiveSnapshot,
  event: LiveEvent,
): LiveSnapshot {
  const base = { ...snapshot, seq: event.seq, updatedAt: event.savedAt };
  switch (event.type) {
    case "score":
      return { ...base, matches: upsert(snapshot.matches, event.match) };
    case "group-standings":
      return { ...base, groups: upsert(snapshot.groups, event.group) };
    case "overall-standings":
      return {
        ...base,
        overall: event.rows,
        overallStandings: event.standings
          ? upsert(snapshot.overallStandings ?? [], event.standings)
          : snapshot.overallStandings,
      };
    case "pending-scores":
      return {
        ...base,
        pendingScores: upsert(snapshot.pendingScores ?? [], event.stage),
      };
    case "phase-started":
      return { ...base, phases: upsert(snapshot.phases ?? [], event.phase) };
    case "board-matches":
      return { ...base, boards: upsert(snapshot.boards ?? [], event.board) };
    case "board-closed":
      return { ...base, closed: upsert(snapshot.closed ?? [], event.board) };
    case "stage-board":
      return {
        ...base,
        stageBoards: upsert(snapshot.stageBoards ?? [], event.stage),
      };
    case "stage-standings":
      return {
        ...base,
        stageStandings: upsert(snapshot.stageStandings ?? [], event.standings),
      };
  }
}
