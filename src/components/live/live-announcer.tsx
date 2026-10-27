"use client";

import { useEffect, useRef, useState } from "react";
import { announcementFor, statusAnnouncement } from "@/lib/live/announce";
import type { LiveStatus } from "@/lib/live/client/live-connection";
import { LIVE_EVENT_TYPES, type LiveEvent } from "@/lib/live/types";
import { useLive } from "./live-provider";

/** Bursts (result + standings) within this window are read together. */
export const ANNOUNCE_INTERVAL_MS = 1_500;
/** At most this many sentences per announcement; the rest is on screen. */
const MAX_SENTENCES = 3;

function eventGroupId(event: LiveEvent): string | undefined {
  if (event.type === "score") return event.match.groupId;
  if (event.type === "group-standings") return event.group.id;
  return undefined;
}

/**
 * Screen-reader announcements of live changes: one polite, atomic region
 * with short sentences («Girone A: nuovo risultato 21-18»). It never moves
 * focus, and the reordered rows themselves are never live regions.
 */
export function LiveAnnouncer({
  types = LIVE_EVENT_TYPES,
  groupId,
  filter: extraFilter,
  format = announcementFor,
  intervalMs = ANNOUNCE_INTERVAL_MS,
}: {
  /** Further narrows the events read (e.g. one stage's). */
  filter?: (event: LiveEvent) => boolean;
  /** The sentence for an event; defaults to `announcementFor`. */
  format?: (event: LiveEvent) => string;
  /** Which kinds of change this page announces. */
  types?: readonly LiveEvent["type"][];
  /** Only this group's results and standings (girone page). */
  groupId?: string;
  intervalMs?: number;
}) {
  const { subscribeEvents, status, freshAt } = useLive();
  const [message, setMessage] = useState({ text: "", n: 0 });
  const queue = useRef<string[]>([]);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const filter = (event: LiveEvent) =>
    types.includes(event.type) &&
    (groupId === undefined || eventGroupId(event) === groupId) &&
    (extraFilter === undefined || extraFilter(event));
  const filterRef = useRef(filter);
  const formatRef = useRef(format);
  const previousStatus = useRef<LiveStatus | null>(null);

  useEffect(() => {
    filterRef.current = filter;
    formatRef.current = format;
  });

  const say = useRef((text: string) => {
    const flush = () => {
      const sentences = [...new Set(queue.current)].slice(-MAX_SENTENCES);
      queue.current = [];
      if (sentences.length === 0) {
        timer.current = null;
        return;
      }
      setMessage((m) => ({ text: sentences.join(". "), n: m.n + 1 }));
      timer.current = setTimeout(flush, intervalMs);
    };
    queue.current.push(text);
    if (timer.current === null) flush();
  });

  useEffect(
    () =>
      subscribeEvents((event) => {
        if (filterRef.current(event)) say.current(formatRef.current(event));
      }),
    [subscribeEvents],
  );

  useEffect(() => {
    const text = statusAnnouncement(previousStatus.current, status, freshAt);
    previousStatus.current = status;
    if (text) say.current(text);
    // Only a status change is announced, not every fresher timestamp.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  useEffect(
    () => () => {
      if (timer.current !== null) clearTimeout(timer.current);
    },
    [],
  );

  return (
    <div
      aria-live="polite"
      aria-atomic="true"
      data-slot="live-announcer"
      className="sr-only"
    >
      {message.text ? <p key={message.n}>{message.text}</p> : null}
    </div>
  );
}
