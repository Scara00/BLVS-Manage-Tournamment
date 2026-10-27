import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { LiveEvent, LiveSnapshot, LiveSync } from "../types";
import { createLiveConnection, type LiveStatus } from "./live-connection";

/** Minimal EventSource the test drives by hand. */
class FakeEventSource {
  static instances: FakeEventSource[] = [];
  readyState = 0;
  closed = false;
  private listeners = new Map<string, ((e: MessageEvent) => void)[]>();

  constructor(public url: string) {
    FakeEventSource.instances.push(this);
  }

  addEventListener(type: string, cb: (e: MessageEvent) => void) {
    this.listeners.set(type, [...(this.listeners.get(type) ?? []), cb]);
  }

  close() {
    this.closed = true;
  }

  emit(type: string, data?: unknown) {
    const message = { data: JSON.stringify(data ?? {}) } as MessageEvent;
    for (const cb of this.listeners.get(type) ?? []) cb(message);
  }

  static get last() {
    return FakeEventSource.instances.at(-1)!;
  }
}

class FakeNetwork extends EventTarget {
  online = true;
  set(online: boolean) {
    this.online = online;
    this.dispatchEvent(new Event(online ? "online" : "offline"));
  }
}

function snapshot(seq: number): LiveSnapshot {
  return {
    seq,
    updatedAt: "2026-06-14T08:00:00.000Z",
    matches: [],
    groups: [],
    overall: [],
  };
}

function event(seq: number): LiveEvent {
  return {
    seq,
    savedAt: "2026-06-14T08:30:00.000Z",
    type: "overall-standings",
    rows: [],
  };
}

function setup({ serverSeq = 0 } = {}) {
  const statuses: LiveStatus[] = [];
  const events: number[] = [];
  const syncs: LiveSync[] = [];
  const network = new FakeNetwork();
  let seq = serverSeq;
  const fetchSync = vi.fn(async (): Promise<LiveSync> => ({
    snapshot: snapshot(seq),
    syncedAt: "2026-06-14T08:31:00.000Z",
  }));
  const connection = createLiveConnection({
    onStatus: (s) => statuses.push(s),
    onEvent: (e) => events.push(e.seq),
    onSync: (s) => syncs.push(s),
    createEventSource: (url) =>
      new FakeEventSource(url) as unknown as EventSource,
    fetchSync,
    random: () => 1,
    network,
    isOnline: () => network.online,
  });
  return {
    connection,
    statuses,
    events,
    syncs,
    network,
    fetchSync,
    setServerSeq: (next: number) => (seq = next),
  };
}

/** Opens the current stream and lets the snapshot fetch settle. */
async function open() {
  FakeEventSource.last.emit("open");
  await vi.advanceTimersByTimeAsync(0);
}

beforeEach(() => {
  vi.useFakeTimers();
  FakeEventSource.instances = [];
});

afterEach(() => {
  vi.useRealTimers();
});

describe("createLiveConnection", () => {
  it("si collega, si riallinea dallo snapshot e passa a live", async () => {
    const t = setup({ serverSeq: 3 });
    t.connection.start();
    expect(t.statuses).toEqual(["connecting"]);
    expect(FakeEventSource.last.url).toBe("/api/live/stream");

    await open();
    expect(t.fetchSync).toHaveBeenCalledWith("/api/live/snapshot");
    expect(t.syncs[0].snapshot.seq).toBe(3);
    expect(t.statuses).toEqual(["connecting", "live"]);
    t.connection.stop();
  });

  it("applica ogni evento una sola volta anche se arriva due volte", async () => {
    const t = setup({ serverSeq: 3 });
    t.connection.start();
    await open();

    const es = FakeEventSource.last;
    es.emit("overall-standings", event(3)); // già nello snapshot
    es.emit("overall-standings", event(4));
    es.emit("overall-standings", event(4)); // duplicato
    es.emit("overall-standings", event(5));
    expect(t.events).toEqual([4, 5]);
    t.connection.stop();
  });

  it("tiene in coda gli eventi arrivati durante il riallineamento", async () => {
    const t = setup({ serverSeq: 3 });
    t.connection.start();
    const es = FakeEventSource.last;
    es.emit("open");
    es.emit("overall-standings", event(3));
    es.emit("overall-standings", event(4));
    expect(t.events).toEqual([]);
    await vi.advanceTimersByTimeAsync(0);
    expect(t.events).toEqual([4]);
    t.connection.stop();
  });

  it("si riconnette con backoff crescente dopo un errore", async () => {
    const t = setup();
    t.connection.start();
    await open();

    FakeEventSource.last.emit("error");
    expect(FakeEventSource.instances[0].closed).toBe(true);
    expect(t.statuses.at(-1)).toBe("reconnecting");

    await vi.advanceTimersByTimeAsync(999);
    expect(FakeEventSource.instances).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(FakeEventSource.instances).toHaveLength(2);

    // Second failure in a row: twice the wait.
    FakeEventSource.last.emit("error");
    await vi.advanceTimersByTimeAsync(1999);
    expect(FakeEventSource.instances).toHaveLength(2);
    await vi.advanceTimersByTimeAsync(1);
    expect(FakeEventSource.instances).toHaveLength(3);

    // Back up: full resync, live again, backoff reset.
    t.setServerSeq(9);
    await open();
    expect(t.statuses.at(-1)).toBe("live");
    expect(t.syncs.at(-1)?.snapshot.seq).toBe(9);
    FakeEventSource.last.emit("error");
    await vi.advanceTimersByTimeAsync(1000);
    expect(FakeEventSource.instances).toHaveLength(4);
    t.connection.stop();
  });

  it("riprova anche quando lo snapshot non arriva", async () => {
    const t = setup();
    t.fetchSync.mockRejectedValueOnce(new Error("500"));
    t.connection.start();
    await open();
    expect(FakeEventSource.instances[0].closed).toBe(true);
    expect(t.statuses.at(-1)).toBe("connecting");
    await vi.advanceTimersByTimeAsync(1000);
    await open();
    expect(t.statuses.at(-1)).toBe("live");
    t.connection.stop();
  });

  it("offline: smette di riprovare e si riallinea al ritorno della rete", async () => {
    const t = setup({ serverSeq: 1 });
    t.connection.start();
    await open();

    t.network.set(false);
    expect(t.statuses.at(-1)).toBe("offline");
    expect(FakeEventSource.instances[0].closed).toBe(true);
    await vi.advanceTimersByTimeAsync(60_000);
    expect(FakeEventSource.instances).toHaveLength(1);

    t.setServerSeq(7);
    t.network.set(true);
    expect(t.statuses.at(-1)).toBe("reconnecting");
    expect(FakeEventSource.instances).toHaveLength(2);
    await open();
    expect(t.syncs.at(-1)?.snapshot.seq).toBe(7);
    expect(t.statuses.at(-1)).toBe("live");
    t.connection.stop();
  });

  it("un errore mentre il browser è offline porta allo stato offline", async () => {
    const t = setup();
    t.connection.start();
    await open();
    t.network.online = false;
    FakeEventSource.last.emit("error");
    expect(t.statuses.at(-1)).toBe("offline");
    await vi.advanceTimersByTimeAsync(60_000);
    expect(FakeEventSource.instances).toHaveLength(1);
    t.connection.stop();
  });

  it("l'evento resync del server forza un nuovo snapshot", async () => {
    const t = setup({ serverSeq: 2 });
    t.connection.start();
    await open();
    t.setServerSeq(20);
    FakeEventSource.last.emit("resync");
    await vi.advanceTimersByTimeAsync(0);
    expect(t.syncs.at(-1)?.snapshot.seq).toBe(20);
    expect(t.fetchSync).toHaveBeenCalledTimes(2);
    t.connection.stop();
  });

  it("stop chiude il canale e non riprova più", async () => {
    const t = setup();
    t.connection.start();
    await open();
    t.connection.stop();
    expect(FakeEventSource.last.closed).toBe(true);
    FakeEventSource.last.emit("error");
    await vi.advanceTimersByTimeAsync(60_000);
    expect(FakeEventSource.instances).toHaveLength(1);
  });
});
