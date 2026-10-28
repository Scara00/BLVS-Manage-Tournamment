"use client";

import { LoaderCircle, RefreshCw, WifiOff } from "lucide-react";
import { useReducedMotion } from "@/components/scoreboard";
import type { LiveStatus } from "@/lib/live/client/live-connection";
import { formatLiveTime } from "@/lib/live/format";
import { cn } from "@/lib/utils";
import { useLive } from "./live-provider";

export type LiveBarProps = {
  status: LiveStatus;
  /** ISO time of the last change to the data shown. */
  updatedAt: string;
  /** ISO time the data was last confirmed current. */
  freshAt: string;
  /** Overrides `prefers-reduced-motion` (stories, tests). */
  reducedMotion?: boolean;
  /**
   * One short line («Live · 14:32»), for a header next to the greeting
   * (w-home, BLVS-52). The full sentence stays for screen readers.
   */
  compact?: boolean;
  className?: string;
};

function Time({ iso }: { iso: string }) {
  return (
    <time dateTime={iso} className="font-mono tabular-nums">
      {formatLiveTime(iso)}
    </time>
  );
}

/**
 * Freshness of the live data: «Live» plus the last update time, or the
 * stale warning while the connection is down. Not a live region: the
 * LiveAnnouncer speaks the changes, this bar is read on demand.
 */
export function LiveBar({
  status,
  updatedAt,
  freshAt,
  reducedMotion,
  compact = false,
  className,
}: LiveBarProps) {
  const still = useReducedMotion(reducedMotion);
  const down = status === "offline" || status === "reconnecting";

  return (
    <section
      aria-label="Stato degli aggiornamenti"
      data-slot="live-bar"
      data-status={status}
      data-compact={compact ? "true" : undefined}
      className={cn(
        "flex flex-wrap items-center border-s-4",
        compact
          ? "gap-x-space-2 gap-y-space-1 px-space-3 py-space-2"
          : "gap-x-space-4 gap-y-space-2 p-inset-sm",
        down
          ? "border-warning-fg bg-warning-bg text-warning-fg"
          : "border-tape bg-background",
        className,
      )}
    >
      {status === "live" ? (
        <>
          <p className="inline-flex items-center gap-space-2 bg-live-bg px-space-2 py-space-1 text-sm font-semibold tracking-wide text-live-fg uppercase">
            <span
              aria-hidden="true"
              className={cn(
                "size-2 rounded-full bg-live-fg",
                !still && "animate-pulse",
              )}
            />
            Live
          </p>
          {compact ? (
            <p className="text-sm">
              <span className="sr-only">Ultimo aggiornamento alle </span>
              <Time iso={updatedAt} />
            </p>
          ) : (
            <p className="text-sm">
              Ultimo aggiornamento alle <Time iso={updatedAt} />
            </p>
          )}
        </>
      ) : null}

      {status === "connecting" ? (
        <p className="inline-flex items-center gap-space-2 text-sm">
          <LoaderCircle
            aria-hidden="true"
            className={cn("size-4 shrink-0", !still && "animate-spin")}
          />
          {compact
            ? "Connessione…"
            : "Connessione agli aggiornamenti in corso…"}
        </p>
      ) : null}

      {down ? (
        <>
          <p className="inline-flex items-center gap-space-2 text-sm font-semibold">
            {status === "offline" ? (
              <WifiOff aria-hidden="true" className="size-4 shrink-0" />
            ) : (
              <RefreshCw
                aria-hidden="true"
                className={cn("size-4 shrink-0", !still && "animate-spin")}
              />
            )}
            Dati non aggiornati dalle <Time iso={freshAt} />
          </p>
          <p className={cn("text-sm", compact && "sr-only")}>
            {status === "offline"
              ? "Sei offline: ci ricolleghiamo appena torna la rete."
              : "Riconnessione in corso…"}
          </p>
        </>
      ) : null}
    </section>
  );
}

/** LiveBar fed by the surrounding LiveProvider. */
export function LiveBarConnected({
  className,
  compact,
  reducedMotion,
}: {
  className?: string;
  compact?: boolean;
  reducedMotion?: boolean;
}) {
  const { status, snapshot, freshAt } = useLive();
  return (
    <LiveBar
      status={status}
      updatedAt={snapshot.updatedAt}
      freshAt={freshAt}
      compact={compact}
      reducedMotion={reducedMotion}
      className={className}
    />
  );
}
