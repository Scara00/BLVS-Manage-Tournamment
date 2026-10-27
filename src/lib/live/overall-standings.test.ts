import { describe, expect, it } from "vitest";
import {
  applyLiveEvent,
  type LiveSnapshot,
  type OverallStandings,
} from "./types";

const snapshot: LiveSnapshot = {
  seq: 3,
  updatedAt: "2026-07-18T08:00:00.000Z",
  matches: [],
  groups: [],
  overall: [],
  pendingScores: [],
};

const standings = (id: string, points: number): OverallStandings => ({
  id,
  category: "M",
  season: 2026,
  rows: [
    {
      playerId: "u1",
      name: "Luca Rossi",
      position: 1,
      points,
      stages: 1,
      provisional: true,
      tied: false,
    },
  ],
});

describe("overall-standings con la classifica per giocatore (BLVS-44)", () => {
  it("sostituisce la classifica con lo stesso id e tiene le altre", () => {
    const meta = { seq: 4, savedAt: "2026-07-18T08:30:00.000Z" };
    let next = applyLiveEvent(snapshot, {
      ...meta,
      type: "overall-standings",
      rows: [],
      standings: standings("M:2026", 12),
    });
    next = applyLiveEvent(next, {
      ...meta,
      seq: 5,
      type: "overall-standings",
      rows: [],
      standings: standings("F:2026", 8),
    });
    next = applyLiveEvent(next, {
      ...meta,
      seq: 6,
      type: "overall-standings",
      rows: [],
      standings: standings("M:2026", 4),
    });
    expect(next.overallStandings?.map((s) => [s.id, s.rows[0].points])).toEqual(
      [
        ["M:2026", 4],
        ["F:2026", 8],
      ],
    );
    expect(next.updatedAt).toBe(meta.savedAt);
  });

  it("un evento vecchio, senza classifica per giocatore, non la tocca", () => {
    const con = { ...snapshot, overallStandings: [standings("M:2026", 12)] };
    const next = applyLiveEvent(con, {
      seq: 4,
      savedAt: "2026-07-18T08:30:00.000Z",
      type: "overall-standings",
      rows: [],
    });
    expect(next.overallStandings).toEqual(con.overallStandings);
  });
});
