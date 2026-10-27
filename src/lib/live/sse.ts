import type { LiveEvent } from "./types";

/** One SSE frame. `id` feeds `Last-Event-ID` on the browser's reconnect. */
export function formatSseEvent(event: LiveEvent): string {
  return `id: ${event.seq}\nevent: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`;
}

/** Tells the client its replay window is gone: refetch the full snapshot. */
export function formatSseResync(seq: number): string {
  return `id: ${seq}\nevent: resync\ndata: {}\n\n`;
}

/**
 * Heartbeat: keeps proxies from closing an idle stream and tells the client
 * its data is still current at `at` (server time).
 */
export function formatSsePing(at: string): string {
  return `event: ping\ndata: ${JSON.stringify({ at })}\n\n`;
}

/** Browser reconnect hint (ms), used only if our own backoff is bypassed. */
export const SSE_RETRY = "retry: 1000\n\n";

/** Parses `Last-Event-ID` or `?since=`; anything else means "no replay". */
export function parseSeq(value: string | null | undefined): number | null {
  if (!value || !/^\d+$/.test(value)) return null;
  return Number(value);
}
