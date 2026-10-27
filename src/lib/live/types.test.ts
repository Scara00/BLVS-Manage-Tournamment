import { describe, expect, it } from "vitest";
import { applyLiveEvent, type LiveSnapshot } from "./types";

const empty: LiveSnapshot = {
  seq: 0,
  updatedAt: "2026-06-14T08:00:00.000Z",
  matches: [],
  groups: [],
  overall: [],
  pendingScores: [],
};

describe("applyLiveEvent: partite da inserire", () => {
  it("aggiunge e poi aggiorna il conteggio della tappa", () => {
    const stage = { id: "jesolo", label: "Tappa 1 · Jesolo", count: 3 };
    const first = applyLiveEvent(empty, {
      type: "pending-scores",
      stage,
      seq: 1,
      savedAt: "2026-06-14T08:01:00.000Z",
    });
    expect(first.pendingScores).toEqual([stage]);
    expect(first.seq).toBe(1);

    const second = applyLiveEvent(first, {
      type: "pending-scores",
      stage: { ...stage, count: 2 },
      seq: 2,
      savedAt: "2026-06-14T08:02:00.000Z",
    });
    expect(second.pendingScores).toEqual([{ ...stage, count: 2 }]);
  });
});

describe("applyLiveEvent: fase avviata", () => {
  it("aggiunge il tabellone anche a uno snapshot senza fasi", () => {
    const phase = {
      id: "cagliari:F",
      stageId: "cagliari",
      label: "Tappa 3 · Cagliari, femminile",
      category: "F" as const,
      phase: "gironi_iniziali" as const,
      matches: 6,
    };
    const next = applyLiveEvent(empty, {
      type: "phase-started",
      phase,
      seq: 4,
      savedAt: "2026-06-14T08:05:00.000Z",
    });
    expect(next.phases).toEqual([phase]);
    expect(next.seq).toBe(4);
  });
});
