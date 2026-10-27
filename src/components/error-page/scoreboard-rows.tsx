import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type ScoreboardRow = {
  label: string;
  value: ReactNode;
  /** `tape` highlights the row that matters: black on yellow tape. */
  tone?: "primary" | "tape";
};

/**
 * Mini scoreboard as a description list: one label/value pair per row.
 * Cells wrap under each other when the text no longer fits (200 % text).
 */
export function ScoreboardRows({
  rows,
  label,
  className,
}: {
  rows: readonly ScoreboardRow[];
  /** Accessible name of the list. */
  label?: string;
  className?: string;
}) {
  return (
    <dl
      data-slot="scoreboard-rows"
      aria-label={label}
      className={cn("flex flex-col gap-space-1", className)}
    >
      {rows.map((row) => (
        <div key={row.label} className="flex flex-wrap gap-0.5">
          <dt className="grow basis-[min(100%,14em)] bg-primary px-space-4 py-space-3 font-mono text-sm font-semibold tracking-widest text-primary-foreground uppercase">
            {row.label}
          </dt>
          <dd
            className={cn(
              "grow-[2] basis-[min(100%,14em)] px-space-4 py-space-3 font-mono text-lg font-bold tracking-wider break-words uppercase",
              row.tone === "tape"
                ? "bg-tape text-primary"
                : "bg-primary text-primary-foreground",
            )}
          >
            {row.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}
