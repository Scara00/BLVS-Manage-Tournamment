"use client";

import { useLive } from "@/components/live";
import { partiteDaInserireLabel } from "@/lib/admin/tappe";
import type { PendingScores } from "@/lib/live/types";
import { cn } from "@/lib/utils";

/**
 * The server count of each stage raced today, replaced by the live one as
 * soon as the bus carries it (`publishPendingScores` after a score write).
 */
export function mergePendingScores(
  initial: readonly PendingScores[],
  live: readonly PendingScores[],
): PendingScores[] {
  return initial.map(
    (stage) => live.find((item) => item.id === stage.id) ?? stage,
  );
}

/** «N partite da inserire» on race day; nothing on other days. */
export function PendingScoresBannerView({
  stages,
  className,
}: {
  stages: readonly PendingScores[];
  className?: string;
}) {
  if (stages.length === 0) return null;
  const total = stages.reduce((sum, stage) => sum + stage.count, 0);
  return (
    <section
      aria-labelledby="partite-da-inserire-titolo"
      data-slot="pending-scores-banner"
      data-count={total}
      className={cn(
        "flex flex-col gap-space-2 border-s-8 border-primary bg-tape p-inset-lg text-primary",
        className,
      )}
    >
      <p className="text-sm font-semibold tracking-wider uppercase">
        Giorno di gara
      </p>
      <h2
        id="partite-da-inserire-titolo"
        className="flex flex-wrap items-baseline gap-x-space-3 font-heading text-2xl font-semibold"
      >
        {total === 0 ? (
          "Tutte le partite sono inserite"
        ) : (
          <>
            <span
              aria-hidden="true"
              className="font-mono text-5xl font-bold tabular-nums"
            >
              {total}
            </span>
            <span aria-hidden="true">
              {total === 1 ? "partita da inserire" : "partite da inserire"}
            </span>
            <span className="sr-only">{partiteDaInserireLabel(total)}</span>
          </>
        )}
      </h2>
      {stages.length > 1 ? (
        <ul className="flex flex-col gap-space-1">
          {stages.map((stage) => (
            <li key={stage.id} data-stage={stage.id}>
              {stage.label}:{" "}
              <span className="font-mono font-semibold tabular-nums">
                {partiteDaInserireLabel(stage.count)}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p>{stages[0].label}</p>
      )}
    </section>
  );
}

/** The banner kept current over the live channel. Needs `<LiveProvider>`. */
export function PendingScoresBanner({
  initial,
}: {
  initial: readonly PendingScores[];
}) {
  const { snapshot } = useLive();
  return (
    <PendingScoresBannerView
      stages={mergePendingScores(initial, snapshot.pendingScores)}
    />
  );
}
