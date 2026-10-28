"use client";

import { useRef } from "react";
import { NotaAssenza } from "@/components/live/nota-assenza";
import {
  liveRowAttributes,
  useLiveRowMotion,
} from "@/components/live/use-live-row-motion";
import {
  ResponsiveTable,
  type ResponsiveTableColumn,
} from "@/components/responsive-table/responsive-table";
import { PhaseBadge } from "@/components/scoreboard";
import {
  posizioneBreve,
  testoTaglio,
  type MeTabellone,
} from "@/lib/tabellone/posizione";
import { ultimaSopra } from "@/lib/tabellone/taglio";
import type {
  GironeTabellone,
  RigaTabellone,
  StatoGironeTabellone,
} from "@/lib/tabellone/types";
import { gironeAncora } from "@/lib/tappe/paths";

const STATO_GIRONE: Record<StatoGironeTabellone, string> = {
  da_giocare: "Da giocare",
  in_corso: "In corso",
  completo: "Concluso",
};

function diff(n: number) {
  return n > 0 ? `+${n}` : String(n);
}

/**
 * One group of w-tabellone: its standing with the qualifying line drawn
 * on color.tape after the last place above it, and the line said as text
 * under the table. The player's row is marked «Tu». Rows that change
 * flash and slide (never with reduced motion); they are never live regions.
 */
export function GironeTabelloneCard({
  girone,
  me,
  livelloHeading = "h4",
  reducedMotion,
}: {
  girone: GironeTabellone;
  me: MeTabellone;
  livelloHeading?: "h3" | "h4";
  reducedMotion?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useLiveRowMotion(ref, reducedMotion);
  const Heading = livelloHeading;
  const titoloId = `${gironeAncora(girone.id)}-titolo`;
  const mia = girone.rows.find((r) => r.playerId === me);
  const indiceTaglio = new Set(
    girone.rows
      .map((_, i) => i)
      .filter((i) => ultimaSopra(girone.rows, i, girone.taglio)),
  );

  const columns: ResponsiveTableColumn<RigaTabellone>[] = [
    {
      key: "position",
      header: "Posizione",
      numeric: true,
      align: "start",
      width: "14%",
      render: (row) => posizioneBreve(row),
    },
    {
      key: "name",
      header: "Giocatore",
      rowHeader: true,
      render: (row) => (
        <span className="inline-flex flex-wrap items-center gap-space-2 [overflow-wrap:anywhere]">
          {row.name}
          {row.note ? <NotaAssenza nota={row.note} /> : null}
          {row.playerId === me ? (
            <span className="bg-primary px-space-2 font-heading text-xs font-semibold tracking-wider text-primary-foreground uppercase">
              Tu
            </span>
          ) : null}
        </span>
      ),
    },
    { key: "played", header: "Giocate", numeric: true, width: "13%" },
    { key: "won", header: "Vinte", numeric: true, width: "12%" },
    {
      key: "diff",
      header: "Diff.",
      numeric: true,
      width: "12%",
      render: (row) => diff(row.diff),
    },
    { key: "points", header: "Punti", numeric: true, width: "12%" },
  ];

  return (
    <section
      id={gironeAncora(girone.id)}
      tabIndex={-1}
      aria-labelledby={titoloId}
      data-testid="girone-tabellone"
      data-mio={mia ? "true" : undefined}
      className="flex min-w-0 scroll-mt-space-6 flex-col gap-space-3 border-2 border-border p-inset focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-primary md:p-inset-lg"
    >
      <div className="flex flex-wrap items-center gap-space-3">
        <Heading
          id={titoloId}
          className="font-heading text-lg font-semibold break-words"
        >
          {girone.nome}
        </Heading>
        {girone.colore ? <PhaseBadge phase={girone.colore} /> : null}
        {girone.stato === "in_corso" ? (
          <p className="bg-live-bg px-space-2 py-space-1 text-xs font-semibold tracking-wide text-live-fg uppercase">
            In corso
          </p>
        ) : (
          <p className="border border-current px-space-2 py-space-1 text-xs font-semibold tracking-wide uppercase">
            {STATO_GIRONE[girone.stato]}
          </p>
        )}
      </div>
      <div
        ref={ref}
        className="[&_[data-mia=true]]:bg-tape-soft [&_dt]:text-foreground [&_li[data-taglio=dopo]]:mb-space-3 [&_li[data-taglio=dopo]]:border-b-4 [&_li[data-taglio=dopo]]:border-b-tape [&_tr[data-taglio=dopo]]:border-b-4 [&_tr[data-taglio=dopo]]:border-b-tape"
      >
        <ResponsiveTable
          caption={`Classifica ${girone.nome}`}
          captionHidden
          columns={columns}
          rows={girone.rows}
          getRowKey={(row) => row.playerId}
          rowAttributes={(row) => ({
            ...liveRowAttributes(row.playerId, row),
            ...(row.playerId === me ? { "data-mia": "true" } : {}),
            ...(indiceTaglio.has(girone.rows.indexOf(row))
              ? { "data-taglio": "dopo" }
              : {}),
          })}
          cardBadgeKey="position"
          emptyMessage="Nessun giocatore nel girone."
        />
      </div>
      {girone.taglio ? (
        <div className="flex flex-col gap-space-1 text-sm" data-testid="taglio">
          <p className="flex flex-wrap items-center gap-space-2">
            <span
              aria-hidden="true"
              className="inline-block h-1 w-8 shrink-0 bg-tape"
            />
            <span>
              Linea di taglio dopo il {girone.taglio.dopo}° posto: sopra{" "}
              {girone.taglio.sopra}, sotto {girone.taglio.sotto}.
            </span>
          </p>
          {mia && testoTaglio(girone, mia) ? (
            <p className="font-semibold" data-testid="taglio-mio">
              Tu: {testoTaglio(girone, mia)!.toLowerCase()}.
            </p>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
