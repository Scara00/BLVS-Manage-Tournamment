import { LIVE_EVENT_TYPES, type LiveEvent, type LiveSync } from "../types";
import { backoffDelay } from "./backoff";
import { createDeduper } from "./dedupe";

/**
 * - `connecting`: first connection, no confirmation yet.
 * - `live`: stream open and data realigned with the server.
 * - `reconnecting`: the stream dropped; retrying with backoff.
 * - `offline`: the browser reports no network; waiting for `online`.
 */
export type LiveStatus = "connecting" | "live" | "reconnecting" | "offline";

type EventSourceLike = Pick<
  EventSource,
  "addEventListener" | "close" | "readyState"
>;

export type LiveConnectionOptions = {
  streamUrl?: string;
  snapshotUrl?: string;
  /** `seq` of the snapshot the page was rendered with. */
  initialSeq?: number;
  onStatus: (status: LiveStatus) => void;
  /** A full resync: replace the client state with this snapshot. */
  onSync: (sync: LiveSync) => void;
  /** A new event, already deduplicated, in order. */
  onEvent: (event: LiveEvent) => void;
  /** Server heartbeat: the data was still current at `at`. */
  onPing?: (at: string) => void;
  createEventSource?: (url: string) => EventSourceLike;
  fetchSync?: (url: string) => Promise<LiveSync>;
  random?: () => number;
  /** Where `online` / `offline` events are heard; defaults to `window`. */
  network?: Pick<Window, "addEventListener" | "removeEventListener">;
  isOnline?: () => boolean;
};

async function defaultFetchSync(url: string): Promise<LiveSync> {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`Snapshot live: HTTP ${res.status}`);
  return (await res.json()) as LiveSync;
}

/**
 * Client side of the live channel, framework-free. Opens the SSE stream,
 * realigns from the snapshot on every (re)open, drops duplicate events,
 * and reconnects with exponential backoff, pausing while offline.
 */
export function createLiveConnection({
  streamUrl = "/api/live/stream",
  snapshotUrl = "/api/live/snapshot",
  initialSeq = 0,
  onStatus,
  onSync,
  onEvent,
  onPing,
  createEventSource = (url) => new EventSource(url),
  fetchSync = defaultFetchSync,
  random,
  network = typeof window === "undefined" ? undefined : window,
  isOnline = () => typeof navigator === "undefined" || navigator.onLine,
}: LiveConnectionOptions) {
  const deduper = createDeduper(initialSeq);
  let source: EventSourceLike | null = null;
  let retryTimer: ReturnType<typeof setTimeout> | null = null;
  let attempt = 0;
  let everLive = false;
  let stopped = true;
  /** Bumped on every new stream so late callbacks of an old one are ignored. */
  let generation = 0;
  let status: LiveStatus | null = null;

  const setStatus = (next: LiveStatus) => {
    if (next === status) return;
    status = next;
    onStatus(next);
  };

  const closeSource = () => {
    generation++;
    source?.close();
    source = null;
  };

  const clearRetry = () => {
    if (retryTimer !== null) clearTimeout(retryTimer);
    retryTimer = null;
  };

  const fail = () => {
    closeSource();
    if (stopped) return;
    if (!isOnline()) {
      setStatus("offline");
      return;
    }
    setStatus(everLive ? "reconnecting" : "connecting");
    clearRetry();
    retryTimer = setTimeout(connect, backoffDelay(attempt++, random));
  };

  function connect() {
    retryTimer = null;
    if (stopped) return;
    closeSource();
    const gen = generation;
    const es = createEventSource(streamUrl);
    source = es;
    let syncing = true;
    let pending: LiveEvent[] = [];

    const deliver = (event: LiveEvent) => {
      if (deduper.accept(event.seq)) onEvent(event);
    };

    const resync = async () => {
      syncing = true;
      try {
        const sync = await fetchSync(snapshotUrl);
        if (gen !== generation) return;
        deduper.reset(sync.snapshot.seq);
        onSync(sync);
        const queued = pending;
        pending = [];
        syncing = false;
        queued.forEach(deliver);
        attempt = 0;
        everLive = true;
        setStatus("live");
      } catch {
        if (gen === generation) fail();
      }
    };

    es.addEventListener("open", () => {
      if (gen === generation) void resync();
    });
    es.addEventListener("error", () => {
      if (gen === generation) fail();
    });
    for (const type of LIVE_EVENT_TYPES) {
      es.addEventListener(type, (message) => {
        if (gen !== generation) return;
        const event = JSON.parse((message as MessageEvent).data) as LiveEvent;
        if (syncing) pending.push(event);
        else deliver(event);
      });
    }
    es.addEventListener("resync", () => {
      if (gen === generation) void resync();
    });
    es.addEventListener("ping", (message) => {
      if (gen !== generation || syncing) return;
      const { at } = JSON.parse((message as MessageEvent).data) as {
        at: string;
      };
      onPing?.(at);
    });
  }

  const handleOffline = () => {
    if (stopped) return;
    clearRetry();
    closeSource();
    setStatus("offline");
  };

  const handleOnline = () => {
    if (stopped) return;
    clearRetry();
    attempt = 0;
    setStatus(everLive ? "reconnecting" : "connecting");
    connect();
  };

  return {
    start() {
      if (!stopped) return;
      stopped = false;
      network?.addEventListener("offline", handleOffline);
      network?.addEventListener("online", handleOnline);
      if (!isOnline()) {
        setStatus("offline");
        return;
      }
      setStatus("connecting");
      connect();
    },
    stop() {
      stopped = true;
      clearRetry();
      closeSource();
      network?.removeEventListener("offline", handleOffline);
      network?.removeEventListener("online", handleOnline);
    },
  };
}
