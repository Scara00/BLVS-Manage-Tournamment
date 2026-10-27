import {
  demoGroups,
  demoLiveMatches,
  demoStandings,
} from "@/lib/demo/tournament";
import type { LiveSnapshot } from "./types";

/**
 * Starting state of the live bus until the real data layer (BLVS-07) feeds
 * it: the demo stage in progress.
 */
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
  };
}
