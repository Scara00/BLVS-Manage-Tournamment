/**
 * Shapes carried by the live channel (scores, group standings, overall
 * standings). Shared by the server bus, the SSE route and the client.
 */

export type SetScore = readonly [home: number, away: number];

export type LiveMatch = {
  id: string;
  court: string;
  groupId: string;
  /** Spoken in announcements, e.g. «Girone A». */
  groupLabel: string;
  home: string;
  away: string;
  sets: readonly SetScore[];
};

export type GroupStandingRow = {
  position: number;
  pair: string;
  played: number;
  won: number;
  points: number;
};

export type GroupStandings = {
  id: string;
  label: string;
  rows: readonly GroupStandingRow[];
};

export type OverallStandingRow = {
  position: number;
  pair: string;
  stages: number;
  points: number;
};

/** Results still to enter for a stage raced today (admin banner). */
export type PendingScores = {
  /** Stage id. */
  id: string;
  /** Stage name, spoken in announcements. */
  label: string;
  count: number;
};

/** A board started a game phase (BLVS-29): its matches now exist. */
export type PhaseStarted = {
  /** `<stage id>:<category>`, one per board. */
  id: string;
  stageId: string;
  /** Spoken in announcements, e.g. «Tappa 3 · Cagliari, maschile». */
  label: string;
  category: "M" | "F";
  phase: "gironi_iniziali";
  /** Matches created, all still to play. */
  matches: number;
};

export type LiveSnapshot = {
  /** Sequence number of the last event folded into this snapshot. */
  seq: number;
  /** ISO time of the last change (or of the seed). */
  updatedAt: string;
  matches: readonly LiveMatch[];
  groups: readonly GroupStandings[];
  overall: readonly OverallStandingRow[];
  /** Per stage, only for the stages that published a count. */
  pendingScores: readonly PendingScores[];
  /** Boards whose phase started; absent in snapshots from before BLVS-29. */
  phases?: readonly PhaseStarted[];
};

/** Snapshot plus the server time it was read: the client's resync payload. */
export type LiveSync = { snapshot: LiveSnapshot; syncedAt: string };

export type LiveEventPayload =
  | { type: "score"; match: LiveMatch }
  | { type: "group-standings"; group: GroupStandings }
  | { type: "overall-standings"; rows: readonly OverallStandingRow[] }
  | { type: "pending-scores"; stage: PendingScores }
  | { type: "phase-started"; phase: PhaseStarted };

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
      return { ...base, overall: event.rows };
    case "pending-scores":
      return {
        ...base,
        pendingScores: upsert(snapshot.pendingScores ?? [], event.stage),
      };
    case "phase-started":
      return { ...base, phases: upsert(snapshot.phases ?? [], event.phase) };
  }
}
