"use client";

import { cn } from "cn";
import { AlertCircleIcon } from "lucide-react";
import { useState } from "react";
import { FlipDigits, Tape } from "@/components/scoreboard";
import { formatLiveTime } from "@/lib/live/format";
import type { LivePartial } from "@/lib/live/types";

type Lato = "home" | "away";

export type PunteggioParzialeProps = {
  partial: LivePartial;
  /** Team names, read by screen readers with the digits. */
  home: string;
  away: string;
  /**
   * The connection is down: the value may be stale, so it says since when
   * («fermo alle HH:MM») instead of looking live.
   */
  offline?: boolean;
  /** Last time the data was known fresh (ISO), shown when offline. */
  freshAt?: string;
  /** Overrides the OS `prefers-reduced-motion` setting (stories, tests). */
  reducedMotion?: boolean;
};

/**
 * The partial of a match in progress (BLVS-37) on w-live: mono digits on a
 * split-flap board (`font.mono`), a «Parziale» label on `color.live` and
 * the last changed side marked on `color.tape`. With reduced motion the
 * digits just change, no flap. Never a live region: the page's single
 * LiveAnnouncer speaks it, at most once every 30 s per match.
 */
export function PunteggioParziale({
  partial,
  home,
  away,
  offline = false,
  freshAt,
  reducedMotion,
}: PunteggioParzialeProps) {
  // Which side changed last, derived from the previous render.
  const [visto, setVisto] = useState(partial);
  const [cambiato, setCambiato] = useState<Lato | null>(null);
  if (partial.home !== visto.home || partial.away !== visto.away) {
    setCambiato(partial.home !== visto.home ? "home" : "away");
    setVisto(partial);
  }

  const lati: { lato: Lato; nome: string; punti: number }[] = [
    { lato: "home", nome: home, punti: partial.home },
    { lato: "away", nome: away, punti: partial.away },
  ];

  return (
    <div
      data-slot="punteggio-parziale"
      data-stato={offline ? "offline" : "live"}
      className="flex flex-col border-2 border-primary bg-background text-foreground"
    >
      <Tape size={4} />
      <div className="flex flex-col gap-space-2 p-space-3">
        <div className="flex flex-wrap items-center gap-space-2">
          <p
            className={cn(
              "px-space-2 py-space-1 text-xs font-semibold tracking-wide uppercase",
              offline ? "border border-current" : "bg-live-bg text-live-fg",
            )}
          >
            {offline ? "Parziale · fermo" : "Parziale · in corso"}
          </p>
          <p className="text-sm">Non entra in classifica</p>
        </div>
        <p
          data-testid="punteggio-parziale"
          className="flex flex-wrap items-center gap-x-space-3 gap-y-space-1 font-mono text-3xl font-bold"
        >
          <span className="sr-only">
            Parziale: {home} {partial.home}, {away} {partial.away}
          </span>
          {lati.map(({ lato, punti }, i) => (
            <span
              key={lato}
              aria-hidden="true"
              className="inline-flex items-center gap-space-3"
            >
              {i > 0 ? <span>–</span> : null}
              <span
                data-cambiato={cambiato === lato ? "" : undefined}
                className={cn(
                  "inline-flex border-b-4 pb-space-1",
                  cambiato === lato ? "border-tape" : "border-transparent",
                )}
              >
                <FlipDigits
                  value={punti}
                  minDigits={2}
                  pad="blank"
                  reducedMotion={reducedMotion}
                />
              </span>
            </span>
          ))}
        </p>
        {offline ? (
          <p className="flex items-start gap-space-2 text-sm font-semibold">
            <AlertCircleIcon aria-hidden className="mt-0.5 size-4 shrink-0" />
            Connessione persa: parziale fermo
            {freshAt ? ` alle ${formatLiveTime(freshAt)}` : ""}
          </p>
        ) : (
          <p className="text-sm">
            Aggiornato alle {formatLiveTime(partial.updatedAt)}
          </p>
        )}
      </div>
    </div>
  );
}
