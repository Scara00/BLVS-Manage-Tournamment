// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import { getLiveBus } from "@/lib/live/bus";
import { publishScore } from "@/lib/live/publish";
import type { LiveEvent } from "@/lib/live/types";
import { GET } from "./route";

vi.mock("server-only", () => ({}));

/** Reads SSE frames off a response body until `match` returns a value. */
async function readUntil<T>(
  body: ReadableStream<Uint8Array>,
  match: (frame: { event?: string; id?: string; data?: string }) => T | null,
): Promise<T> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) throw new Error("Stream chiuso prima dell'evento atteso");
      buffer += decoder.decode(value, { stream: true });
      let end: number;
      while ((end = buffer.indexOf("\n\n")) !== -1) {
        const raw = buffer.slice(0, end);
        buffer = buffer.slice(end + 2);
        const frame: Record<string, string> = {};
        for (const line of raw.split("\n")) {
          const i = line.indexOf(": ");
          if (i > 0) frame[line.slice(0, i)] = line.slice(i + 2);
        }
        const found = match(frame);
        if (found !== null) return found;
      }
    }
  } finally {
    reader.releaseLock();
  }
}

const controllers: AbortController[] = [];
function open(headers: Record<string, string> = {}) {
  const controller = new AbortController();
  controllers.push(controller);
  return GET(
    new Request("http://localhost/api/live/stream", {
      headers,
      signal: controller.signal,
    }),
  );
}

afterEach(() => {
  controllers.splice(0).forEach((c) => c.abort());
});

const match = {
  id: "m1",
  court: "Campo 1",
  groupId: "a",
  groupLabel: "Girone A",
  home: "Rossi / Bianchi",
  away: "Marino / Greco",
  sets: [[21, 18]] as const,
};

describe("GET /api/live/stream", () => {
  it("risponde come event-stream senza cache", async () => {
    const res = await open();
    expect(res.headers.get("content-type")).toContain("text/event-stream");
    expect(res.headers.get("cache-control")).toContain("no-cache");
  });

  it("consegna un risultato al client entro 5 s dal salvataggio", async () => {
    const res = await open();
    const arrived = readUntil(res.body!, (frame) =>
      frame.event === "score" ? (JSON.parse(frame.data!) as LiveEvent) : null,
    );

    const savedAt = performance.now();
    const saved = publishScore(match);
    const event = await arrived;
    const elapsed = performance.now() - savedAt;
    expect(event.seq).toBe(saved.seq);
    expect(event.type === "score" && event.match.sets).toEqual([[21, 18]]);
    expect(elapsed).toBeLessThan(5_000);
  });

  it("dopo una riconnessione riproduce gli eventi persi (Last-Event-ID)", async () => {
    const before = getLiveBus().snapshot().seq;
    publishScore({ ...match, sets: [[1, 0]] });
    publishScore({ ...match, sets: [[2, 0]] });

    const res = await open({ "last-event-id": String(before) });
    const ids: string[] = [];
    await readUntil(res.body!, (frame) => {
      if (frame.event === "score") ids.push(frame.id!);
      return ids.length === 2 ? true : null;
    });
    expect(ids).toEqual([String(before + 1), String(before + 2)]);
  });

  it("chiede il riallineamento se il Last-Event-ID non è più valido", async () => {
    const res = await open({ "last-event-id": "999999" });
    const event = await readUntil(res.body!, (frame) => frame.event ?? null);
    expect(event).toBe("resync");
  });

  it("alla chiusura del client si disiscrive dal bus", async () => {
    const listeners = getLiveBus().listenerCount();
    await open();
    expect(getLiveBus().listenerCount()).toBe(listeners + 1);
    controllers.splice(0).forEach((c) => c.abort());
    expect(getLiveBus().listenerCount()).toBe(listeners);
  });
});
