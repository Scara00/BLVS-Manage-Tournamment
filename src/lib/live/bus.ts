import "server-only";
import { now } from "@/lib/time/server-time";
import { demoLiveSnapshot } from "./seed";
import {
  applyLiveEvent,
  type LiveEvent,
  type LiveEventPayload,
  type LiveSnapshot,
} from "./types";

export type LiveListener = (event: LiveEvent) => void;

/** How many past events a reconnecting client can replay. */
export const LIVE_REPLAY_CAPACITY = 200;

/**
 * In-process pub/sub for the live channel. It keeps the current snapshot (so
 * a full resync is always consistent with the stream) and a ring buffer of
 * recent events for `Last-Event-ID` replay.
 *
 * Single instance only: with several server instances a shared backend
 * (e.g. Supabase Realtime) must fan events out instead.
 */
export function createLiveBus(
  initial: LiveSnapshot,
  capacity = LIVE_REPLAY_CAPACITY,
) {
  let snapshot = initial;
  let buffer: LiveEvent[] = [];
  const listeners = new Set<LiveListener>();

  return {
    publish(payload: LiveEventPayload, savedAt: Date = now()): LiveEvent {
      const event = {
        ...payload,
        seq: snapshot.seq + 1,
        savedAt: savedAt.toISOString(),
      } as LiveEvent;
      snapshot = applyLiveEvent(snapshot, event);
      buffer = [...buffer, event].slice(-capacity);
      for (const listener of listeners) {
        try {
          listener(event);
        } catch (error) {
          console.error("[live] listener failed", error);
        }
      }
      return event;
    },

    subscribe(listener: LiveListener): () => void {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },

    /**
     * Events after `seq`, oldest first. `null` when the gap is older than
     * the buffer (or `seq` is from a previous server life): the client must
     * resync from the snapshot.
     */
    since(seq: number): LiveEvent[] | null {
      if (seq > snapshot.seq) return null;
      if (seq === snapshot.seq) return [];
      const oldest = buffer[0]?.seq ?? snapshot.seq + 1;
      if (seq < oldest - 1) return null;
      return buffer.filter((e) => e.seq > seq);
    },

    snapshot(): LiveSnapshot {
      return snapshot;
    },

    listenerCount(): number {
      return listeners.size;
    },
  };
}

export type LiveBus = ReturnType<typeof createLiveBus>;

const globalForLive = globalThis as typeof globalThis & {
  __blvsLiveBus?: LiveBus;
};

/** The process-wide bus. Kept on globalThis so dev HMR doesn't fork it. */
export function getLiveBus(): LiveBus {
  globalForLive.__blvsLiveBus ??= createLiveBus(
    demoLiveSnapshot(now().toISOString()),
  );
  return globalForLive.__blvsLiveBus;
}
