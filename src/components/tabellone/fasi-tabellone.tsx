"use client";

import { Tape } from "@/components/scoreboard";
import { passiFasi } from "@/lib/tabellone/fasi";
import type { FaseDelTabellonePasso, StatoPasso } from "@/lib/tabellone/types";
import { cn } from "@/lib/utils";

const STATO_PASSO: Record<StatoPasso, string> = {
  fatta: "Fatta",
  corrente: "Adesso",
  futura: "Da fare",
};

/**
 * The steps of one board as text (R-30), the current one marked with
 * `aria-current="step"`, color.primary and the tape. The tape snaps in when
 * the phase changes, never with reduced motion.
 */
export function FasiTabellone({
  corrente,
  label,
  reducedMotion,
}: {
  corrente: FaseDelTabellonePasso;
  /** Names the list, e.g. «Fasi del tabellone maschile». */
  label: string;
  reducedMotion?: boolean;
}) {
  return (
    <ol
      aria-label={label}
      data-testid="fasi-tabellone"
      className="grid grid-cols-1 gap-space-2 sm:grid-cols-5"
    >
      {passiFasi(corrente).map((passo) => {
        const attuale = passo.stato === "corrente";
        return (
          <li
            key={passo.fase}
            aria-current={attuale ? "step" : undefined}
            data-stato={passo.stato}
            className={cn(
              "flex min-w-0 flex-col border-2",
              attuale
                ? "border-primary bg-primary text-primary-foreground"
                : passo.stato === "fatta"
                  ? "border-primary bg-background text-foreground"
                  : "border-border bg-background text-foreground",
            )}
          >
            {attuale ? (
              <Tape
                // A new phase remounts the tape, so it snaps in again.
                key={passo.fase}
                size={8}
                animated
                reducedMotion={reducedMotion}
              />
            ) : null}
            <span className="flex flex-col gap-space-1 p-inset">
              <span className="font-heading font-semibold break-words">
                {passo.label}
              </span>
              <span className="text-sm">{STATO_PASSO[passo.stato]}</span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}
