"use client";

import { useRef } from "react";
import {
  ResponsiveTable,
  type ResponsiveTableColumn,
} from "@/components/responsive-table/responsive-table";
import type {
  GroupStandingRow,
  LiveMatch,
  OverallStandingRow,
} from "@/lib/live/types";
import { useLive } from "./live-provider";
import { NotaAssenza } from "./nota-assenza";
import { liveRowAttributes, useLiveRowMotion } from "./use-live-row-motion";

function setsLabel(match: LiveMatch) {
  return match.sets
    .map(([home, away], i) => `set ${i + 1} ${home} a ${away}`)
    .join(", ");
}

/** The matches in progress, court by court (w-live). */
export function LiveMatches({ groupId }: { groupId?: string }) {
  const { snapshot } = useLive();
  const ref = useRef<HTMLUListElement>(null);
  useLiveRowMotion(ref);
  const matches = groupId
    ? snapshot.matches.filter((m) => m.groupId === groupId)
    : snapshot.matches;

  if (matches.length === 0) {
    return (
      <p className="border border-border p-inset text-muted-foreground">
        Nessuna partita in corso.
      </p>
    );
  }

  return (
    <ul ref={ref} className="grid gap-stack md:grid-cols-2">
      {matches.map((match) => (
        <li
          key={match.id}
          {...liveRowAttributes(match.id, match)}
          className="flex flex-col gap-space-3 border border-border p-inset-lg"
        >
          <div className="flex flex-wrap items-center gap-space-3">
            <p className="bg-live-bg px-space-2 py-space-1 text-xs font-semibold tracking-wide text-live-fg uppercase">
              Live
            </p>
            <p className="text-sm text-muted-foreground">
              {match.court} · {match.groupLabel}
            </p>
          </div>
          <h2 className="font-heading text-lg font-semibold">
            {match.home} <span className="font-normal">contro</span>{" "}
            {match.away}
          </h2>
          <p className="font-mono text-2xl font-semibold tabular-nums">
            <span className="sr-only">{setsLabel(match)}</span>
            <span aria-hidden="true">
              {match.sets.map(([h, a]) => `${h}–${a}`).join(" · ")}
            </span>
          </p>
        </li>
      ))}
    </ul>
  );
}

const overallColumns: ResponsiveTableColumn<OverallStandingRow>[] = [
  {
    key: "position",
    header: "Posizione",
    numeric: true,
    align: "start",
    width: "18%",
  },
  { key: "pair", header: "Coppia", rowHeader: true },
  { key: "stages", header: "Tappe giocate", numeric: true, width: "20%" },
  { key: "points", header: "Punti", numeric: true, width: "16%" },
];

/** General circuit standings (w-classifica). */
export function LiveOverallStandings() {
  const { snapshot } = useLive();
  const ref = useRef<HTMLDivElement>(null);
  useLiveRowMotion(ref);
  return (
    <div ref={ref}>
      <ResponsiveTable
        caption="Classifica generale maschile"
        columns={overallColumns}
        rows={snapshot.overall}
        getRowKey={(row) => row.pair}
        rowAttributes={(row) => liveRowAttributes(row.pair, row)}
        cardBadgeKey="position"
        emptyMessage="Nessuna coppia in classifica."
      />
    </div>
  );
}

const groupColumns: ResponsiveTableColumn<GroupStandingRow>[] = [
  {
    key: "position",
    header: "Posizione",
    numeric: true,
    align: "start",
    width: "16%",
  },
  {
    key: "pair",
    header: "Coppia",
    rowHeader: true,
    render: (row) =>
      row.note ? (
        <span className="inline-flex flex-wrap items-center gap-space-2 [overflow-wrap:anywhere]">
          {row.pair}
          <NotaAssenza nota={row.note} />
        </span>
      ) : (
        row.pair
      ),
  },
  { key: "played", header: "Giocate", numeric: true, width: "14%" },
  { key: "won", header: "Vinte", numeric: true, width: "14%" },
  { key: "points", header: "Punti", numeric: true, width: "14%" },
];

/** Standings of one pool-phase group (w-girone). */
export function LiveGroupStandings({ groupId }: { groupId: string }) {
  const { snapshot } = useLive();
  const ref = useRef<HTMLDivElement>(null);
  useLiveRowMotion(ref);
  const group = snapshot.groups.find((g) => g.id === groupId);
  return (
    <div ref={ref}>
      <ResponsiveTable
        caption={`Classifica ${group?.label ?? "del girone"}`}
        columns={groupColumns}
        rows={group?.rows ?? []}
        getRowKey={(row) => row.pair}
        rowAttributes={(row) => liveRowAttributes(row.pair, row)}
        cardBadgeKey="position"
        emptyMessage="Nessuna coppia nel girone."
      />
    </div>
  );
}
