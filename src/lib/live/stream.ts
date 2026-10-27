import "server-only";
import { now } from "@/lib/time/server-time";
import type { LiveBus } from "./bus";
import {
  formatSseEvent,
  formatSseResync,
  formatSsePing,
  SSE_RETRY,
} from "./sse";

export const HEARTBEAT_MS = 15_000;

export const SSE_HEADERS = {
  "Content-Type": "text/event-stream; charset=utf-8",
  "Cache-Control": "no-cache, no-transform",
  Connection: "keep-alive",
  // Disables response buffering on nginx-style proxies.
  "X-Accel-Buffering": "no",
} as const;

/**
 * SSE body for one client: replays what it missed after `lastSeq` (or asks
 * it to resync), then forwards every new event until `signal` aborts.
 */
export function createLiveStream(
  bus: LiveBus,
  lastSeq: number | null,
  signal: AbortSignal,
): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  let cleanup = () => {};

  return new ReadableStream<Uint8Array>({
    start(controller) {
      let closed = false;
      const send = (chunk: string) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(chunk));
        } catch {
          cleanup();
        }
      };

      send(SSE_RETRY);
      if (lastSeq !== null) {
        const missed = bus.since(lastSeq);
        if (missed === null) send(formatSseResync(bus.snapshot().seq));
        else missed.forEach((event) => send(formatSseEvent(event)));
      }

      const unsubscribe = bus.subscribe((event) => send(formatSseEvent(event)));
      const heartbeat = setInterval(
        () => send(formatSsePing(now().toISOString())),
        HEARTBEAT_MS,
      );

      cleanup = () => {
        if (closed) return;
        closed = true;
        unsubscribe();
        clearInterval(heartbeat);
        signal.removeEventListener("abort", cleanup);
        try {
          controller.close();
        } catch {
          // Already closed by the runtime.
        }
      };
      if (signal.aborted) cleanup();
      else signal.addEventListener("abort", cleanup);
    },
    cancel() {
      cleanup();
    },
  });
}
