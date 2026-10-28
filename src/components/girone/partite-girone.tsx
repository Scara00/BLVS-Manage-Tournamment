"use client";

import { useRef } from "react";
import { useLive } from "@/components/live/live-provider";
import {
  setsLabel,
  STATO_PARTITA,
  Team,
  teamName,
} from "@/components/live/match-parts";
import { PunteggioParziale } from "@/components/live/punteggio-parziale";
import {
  liveRowAttributes,
  useLiveRowMotion,
} from "@/components/live/use-live-row-motion";
import { punteggioVisibile, type LiveMe } from "@/lib/live/tappa";
import type { LiveMatch } from "@/lib/live/types";

function Punteggio({
  match,
  className,
}: {
  match: LiveMatch;
  className: string;
}) {
  return (
    <p className={className} data-slot="girone-punteggio">
      <span className="sr-only">{setsLabel(match)}</span>
      <span aria-hidden="true" className="whitespace-nowrap">
        {match.sets.length > 0 ? punteggioVisibile(match) : "–"}
      </span>
    </p>
  );
}

/**
 * The match being played now, in evidence (R-48): full names, «Live» on
 * color.live, the partial as split-flap digits.
 */
export function PartitaInEvidenza({
  match,
  me,
  reducedMotion,
}: {
  match: LiveMatch | null;
  me: LiveMe;
  reducedMotion?: boolean;
}) {
  const { status, freshAt } = useLive();
  const ref = useRef<HTMLDivElement>(null);
  useLiveRowMotion(ref, reducedMotion);
  if (!match) {
    return (
      <p className="border border-border p-inset" data-testid="girone-in-corso">
        Nessuna partita in corso nel girone.
      </p>
    );
  }
  const partial = match.partial ?? null;
  return (
    <div ref={ref} data-testid="girone-in-corso">
      <article
        {...liveRowAttributes(match.id, match)}
        className="flex flex-col gap-space-3 border-2 border-primary bg-background p-inset-lg"
      >
        <div className="flex flex-wrap items-center gap-space-3">
          <p className="bg-live-bg px-space-2 py-space-1 text-xs font-semibold tracking-wide text-live-fg uppercase">
            Live
          </p>
          <p className="text-sm [overflow-wrap:anywhere]">
            {match.court}
            {match.round ? ` · Turno ${match.round}` : null}
          </p>
        </div>
        <h3 className="font-heading text-2xl font-semibold break-words">
          <Team players={match.players?.home} fallback={match.home} me={me} />{" "}
          <span className="font-normal">contro</span>{" "}
          <Team players={match.players?.away} fallback={match.away} me={me} />
        </h3>
        {partial ? (
          <PunteggioParziale
            partial={partial}
            home={teamName(match.players?.home, match.home)}
            away={teamName(match.players?.away, match.away)}
            offline={status === "offline" || status === "reconnecting"}
            freshAt={freshAt}
            reducedMotion={reducedMotion}
          />
        ) : null}
        <Punteggio
          match={match}
          className={
            partial && match.sets.length === 0
              ? "hidden"
              : "font-mono text-3xl font-semibold tabular-nums"
          }
        />
      </article>
    </div>
  );
}

/**
 * The other matches of the group as light rows (R-49): turn, names, score
 * in mono and the state as text.
 */
export function PartiteGirone({
  matches,
  me,
  reducedMotion,
}: {
  matches: readonly LiveMatch[];
  me: LiveMe;
  reducedMotion?: boolean;
}) {
  const ref = useRef<HTMLUListElement>(null);
  useLiveRowMotion(ref, reducedMotion);
  if (matches.length === 0) {
    return (
      <p className="border border-border p-inset">
        Nessun’altra partita nel girone.
      </p>
    );
  }
  return (
    <ul ref={ref} data-testid="girone-partite" className="flex flex-col">
      {matches.map((match) => {
        const state = match.state ?? "in_corso";
        return (
          <li
            key={match.id}
            {...liveRowAttributes(match.id, match)}
            data-stato={state}
            className="flex flex-wrap items-baseline gap-x-space-4 gap-y-space-1 border-b border-border py-space-3"
          >
            <p className="w-full text-sm sm:w-auto sm:min-w-28">
              {match.round ? `Turno ${match.round}` : match.court}
              {" · "}
              <span className="font-semibold">{STATO_PARTITA[state]}</span>
            </p>
            <p className="min-w-0 flex-1 [overflow-wrap:anywhere]">
              <Team
                players={match.players?.home}
                fallback={match.home}
                me={me}
              />{" "}
              <span>contro</span>{" "}
              <Team
                players={match.players?.away}
                fallback={match.away}
                me={me}
              />
            </p>
            <Punteggio
              match={match}
              className="font-mono text-lg font-semibold tabular-nums"
            />
          </li>
        );
      })}
    </ul>
  );
}
