"use client";

import { useEffect, useRef, useState } from "react";
import { announcementFor, statusAnnouncement } from "@/lib/live/announce";
import { creaLimitatore } from "@/lib/live/limita-annunci";
import { now } from "@/lib/time/server-time";
import type { LiveStatus } from "@/lib/live/client/live-connection";
import { LIVE_EVENT_TYPES, type LiveEvent } from "@/lib/live/types";
import { useLive } from "./live-provider";

/** Bursts (result + standings) within this window are read together. */
export const ANNOUNCE_INTERVAL_MS = 1_500;
/** At most this many sentences per announcement; the rest is on screen. */
const MAX_SENTENCES = 3;

/**
 * Rate limit for some events (BLVS-37: a match's partial). `chiave` names
 * the limited events (one window per key); `libera` names events that are
 * never limited but drop the key's pending text (the official result).
 */
export type LimiteAnnunci = {
  chiave: (event: LiveEvent) => string | null;
  libera?: (event: LiveEvent) => string | null;
  /** One announcement per key per window; defaults to 30 s. */
  intervalloMs?: number;
};

function eventGroupId(event: LiveEvent): string | undefined {
  if (event.type === "score") return event.match.groupId;
  if (event.type === "group-standings") return event.group.id;
  if (event.type === "board-matches") return event.board.id;
  if (event.type === "board-closed") return event.board.id;
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
  limita,
}: {
  /** Further narrows the events read (e.g. one stage's). */
  filter?: (event: LiveEvent) => boolean;
  /** The sentence for an event; defaults to `announcementFor`. */
  format?: (event: LiveEvent) => string;
  /** Which kinds of change this page announces. */
  types?: readonly LiveEvent["type"][];
  /**
   * Only this group's results and standings (girone page), or this board's
   * matches (`<stage>:<M|F>`, w-admin-live).
   */
  groupId?: string;
  intervalMs?: number;
  /** Limits some events per key (e.g. one partial per match every 30 s). */
  limita?: LimiteAnnunci;
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
  const limitaRef = useRef(limita);
  const previousStatus = useRef<LiveStatus | null>(null);
  const [limitatore] = useState(() => creaLimitatore(limita?.intervalloMs));
  const timerLimite = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    filterRef.current = filter;
    formatRef.current = format;
    limitaRef.current = limita;
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

  // Pending limited texts are said when their window reopens.
  const pianifica = useRef(() => {
    const due = limitatore.prossimo();
    if (due === null || timerLimite.current !== null) return;
    timerLimite.current = setTimeout(
      () => {
        timerLimite.current = null;
        for (const text of limitatore.maturi(now().getTime()))
          say.current(text);
        pianifica.current();
      },
      Math.max(0, due - now().getTime()),
    );
  });

  useEffect(
    () =>
      subscribeEvents((event) => {
        if (!filterRef.current(event)) return;
        const text = formatRef.current(event);
        const regola = limitaRef.current;
        const chiave = regola?.chiave(event) ?? null;
        if (chiave === null) {
          const libera = regola?.libera?.(event);
          if (libera) limitatore.scarta(libera);
          say.current(text);
          return;
        }
        const proposta = limitatore.proponi(chiave, text, now().getTime());
        if (proposta.dire !== null) say.current(proposta.dire);
        else pianifica.current();
      }),
    [subscribeEvents, limitatore],
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
      if (timerLimite.current !== null) clearTimeout(timerLimite.current);
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
