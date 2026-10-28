import "server-only";
import { now } from "@/lib/time/server-time";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { createSupabaseRelay, type LiveRelay } from "./relay";
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
 * With a `relay` (BLVS-56) every publish is also sent to the other server
 * instances, and theirs are applied here. `seq` then follows the save time
 * in ms (never going back), so it stays comparable across instances: a
 * client may read the snapshot from one instance and the stream from
 * another. Without a relay `seq` simply counts 1, 2, 3…
 */
export function createLiveBus(
  initial: LiveSnapshot,
  capacity = LIVE_REPLAY_CAPACITY,
  relay: LiveRelay | null = null,
) {
  let snapshot = initial;
  let buffer: LiveEvent[] = [];
  const listeners = new Set<LiveListener>();

  const apply = (
    payload: LiveEventPayload,
    seq: number,
    savedAt: string,
  ): LiveEvent => {
    const event = { ...payload, seq, savedAt } as LiveEvent;
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
  };

  relay?.onReceive((message) =>
    apply(
      message.payload,
      Math.max(snapshot.seq + 1, message.seq),
      message.savedAt,
    ),
  );

  return {
    publish(payload: LiveEventPayload, savedAt: Date = now()): LiveEvent {
      const seq = relay
        ? Math.max(snapshot.seq + 1, savedAt.getTime())
        : snapshot.seq + 1;
      const event = apply(payload, seq, savedAt.toISOString());
      relay?.send({ payload, seq, savedAt: event.savedAt });
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

/**
 * The process-wide bus. Kept on globalThis so dev HMR doesn't fork it.
 * With Supabase configured it relays through Realtime (see `relay.ts`).
 */
export function getLiveBus(): LiveBus {
  if (!globalForLive.__blvsLiveBus) {
    // No secret key (demo, e2e, unit tests): one instance, no relay.
    const secretKey = process.env.SUPABASE_SECRET_KEY || null;
    globalForLive.__blvsLiveBus = createLiveBus(
      demoLiveSnapshot(now().toISOString()),
      LIVE_REPLAY_CAPACITY,
      secretKey ? createSupabaseRelay(getSupabaseAdmin(), secretKey) : null,
    );
  }
  return globalForLive.__blvsLiveBus;
}
