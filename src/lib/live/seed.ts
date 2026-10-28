import {
  demoGroups,
  demoLiveMatches,
  demoStandings,
} from "@/lib/demo/tournament";
import type { LiveSnapshot } from "./types";

/** Starting state of the live bus with Supabase: events fill it. */
export function emptyLiveSnapshot(updatedAt: string): LiveSnapshot {
  return {
    seq: 0,
    updatedAt,
    matches: [],
    groups: [],
    overall: [],
    pendingScores: [],
    phases: [],
  };
}

/** Starting state of the live bus without Supabase: the demo stage. */
export function demoLiveSnapshot(updatedAt: string): LiveSnapshot {
  const labels = new Map(demoGroups.map((g) => [g.id, g.label]));
  return {
    seq: 0,
    updatedAt,
    matches: demoLiveMatches.map((m) => ({
      ...m,
      groupLabel: labels.get(m.groupId) ?? m.groupId,
    })),
    groups: demoGroups,
    overall: demoStandings,
    pendingScores: [],
    phases: [],
  };
}
