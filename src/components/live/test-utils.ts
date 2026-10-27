import type { LiveConnectionOptions } from "@/lib/live/client/live-connection";
import type { LiveEvent, LiveSnapshot, LiveSync } from "@/lib/live/types";

/** EventSource stand-in for component tests; `emit` drives it. */
export class TestEventSource {
  static last: TestEventSource | null = null;
  readyState = 1;
  private listeners = new Map<string, ((e: MessageEvent) => void)[]>();

  constructor() {
    TestEventSource.last = this;
  }

  addEventListener(type: string, cb: (e: MessageEvent) => void) {
    this.listeners.set(type, [...(this.listeners.get(type) ?? []), cb]);
  }

  close() {}

  emit(type: string, data: unknown = {}) {
    const message = { data: JSON.stringify(data) } as MessageEvent;
    for (const cb of this.listeners.get(type) ?? []) cb(message);
  }

  send(event: LiveEvent) {
    this.emit(event.type, event);
  }
}

export const baseSnapshot: LiveSnapshot = {
  seq: 0,
  updatedAt: "2026-06-14T08:00:00.000Z",
  matches: [
    {
      id: "m1",
      court: "Campo 1",
      groupId: "a",
      groupLabel: "Girone A",
      home: "Rossi / Bianchi",
      away: "Marino / Greco",
      sets: [[12, 9]],
    },
  ],
  groups: [
    {
      id: "a",
      label: "Girone A",
      rows: [
        { position: 1, pair: "Rossi / Bianchi", played: 1, won: 1, points: 3 },
        { position: 2, pair: "Marino / Greco", played: 1, won: 0, points: 0 },
      ],
    },
  ],
  overall: [],
};

export const baseSync: LiveSync = {
  snapshot: baseSnapshot,
  syncedAt: "2026-06-14T08:00:00.000Z",
};

/** Transport for LiveProvider that never touches the network. */
export function testConnection(
  sync: LiveSync = baseSync,
): Partial<LiveConnectionOptions> {
  return {
    createEventSource: () => new TestEventSource() as unknown as EventSource,
    fetchSync: async () => sync,
    network: new EventTarget() as unknown as Window,
    isOnline: () => true,
  };
}
