// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { createLiveBus } from "./bus";
import type { LiveMatch, LiveSnapshot } from "./types";

vi.mock("server-only", () => ({}));

const empty: LiveSnapshot = {
  seq: 0,
  updatedAt: "2026-06-14T08:00:00.000Z",
  matches: [],
  groups: [],
  overall: [],
};
const match: LiveMatch = {
  id: "m1",
  court: "Campo 1",
  groupId: "a",
  groupLabel: "Girone A",
  home: "A",
  away: "B",
  sets: [[21, 18]],
};
const at = new Date("2026-06-14T08:30:00.000Z");

describe("createLiveBus", () => {
  it("numera gli eventi e li applica allo snapshot", () => {
    const bus = createLiveBus(empty);
    const event = bus.publish({ type: "score", match }, at);
    expect(event.seq).toBe(1);
    expect(event.savedAt).toBe(at.toISOString());
    expect(bus.snapshot().seq).toBe(1);
    expect(bus.snapshot().matches).toEqual([match]);

    bus.publish({ type: "score", match: { ...match, sets: [[5, 3]] } }, at);
    expect(bus.snapshot().matches).toHaveLength(1);
    expect(bus.snapshot().matches[0].sets).toEqual([[5, 3]]);
  });

  it("consegna gli eventi agli iscritti finché non si disiscrivono", () => {
    const bus = createLiveBus(empty);
    const listener = vi.fn();
    const off = bus.subscribe(listener);
    bus.publish({ type: "overall-standings", rows: [] }, at);
    off();
    bus.publish({ type: "overall-standings", rows: [] }, at);
    expect(listener).toHaveBeenCalledTimes(1);
    expect(bus.listenerCount()).toBe(0);
  });

  it("riproduce gli eventi persi o chiede il riallineamento", () => {
    const bus = createLiveBus(empty, 3);
    for (let i = 0; i < 5; i++) {
      bus.publish({ type: "overall-standings", rows: [] }, at);
    }
    expect(bus.since(5)).toEqual([]);
    expect(bus.since(3)?.map((e) => e.seq)).toEqual([4, 5]);
    expect(bus.since(2)?.map((e) => e.seq)).toEqual([3, 4, 5]);
    // Seq 2 is the oldest replayable gap; 1 is out of the buffer.
    expect(bus.since(1)).toBeNull();
    // A seq from a previous server life.
    expect(bus.since(99)).toBeNull();
  });
});
