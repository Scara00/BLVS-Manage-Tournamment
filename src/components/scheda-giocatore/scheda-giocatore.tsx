"use client";

import Link from "next/link";
import { useRef, type ReactNode } from "react";
import {
  BadgeTu,
  PuntiProvvisori,
} from "@/components/classifica-generale/riga-giocatore";
import { classificaHref } from "@/components/classifica-generale/filtri";
import { useLive } from "@/components/live/live-provider";
import {
  liveRowAttributes,
  useLiveRowMotion,
} from "@/components/live/use-live-row-motion";
import {
  ResponsiveTable,
  type ResponsiveTableColumn,
} from "@/components/responsive-table/responsive-table";
import { puntiProvvisoriLabel } from "@/lib/classifica-generale/annuncio";
import {
  categoriaLabel,
  dataTappaLabel,
  faseTappaTesto,
  nomeGiocatore,
  rigaGiocatore,
  tappeGiocatore,
} from "@/lib/classifica-generale/giocatore";
import { stagioneLabel } from "@/lib/classifica-generale/stagione";
import type { Categoria } from "@/lib/db/types";
import type { OverallStageResult } from "@/lib/live/types";
import { classificaTappaHref } from "@/lib/tappe/paths";

const linkClass =
  "font-semibold underline decoration-2 underline-offset-4 focus-ring";

function colonne(
  categoria: Categoria,
): ResponsiveTableColumn<OverallStageResult>[] {
  return [
    {
      key: "stage",
      header: "Tappa",
      rowHeader: true,
      render: (row) => (
        <Link
          href={classificaTappaHref(row.stageId, categoria)}
          className={linkClass}
          data-testid="link-classifica-tappa"
        >
          {row.name}
          <span className="sr-only">: classifica della tappa</span>
        </Link>
      ),
    },
    {
      key: "date",
      header: "Data",
      width: "18%",
      render: (row) => dataTappaLabel(row.date),
    },
    {
      key: "phase",
      header: "Fase",
      width: "18%",
      render: (row) => {
        const { simbolo, testo } = faseTappaTesto(row.phase);
        return (
          <span data-slot="fase-tappa" data-fase={row.phase ?? "nessuna"}>
            {simbolo ? (
              <span aria-hidden="true" className="me-space-1">
                {simbolo}
              </span>
            ) : null}
            {testo}
          </span>
        );
      },
    },
    {
      key: "position",
      header: "Posizione",
      numeric: true,
      align: "start",
      width: "18%",
      render: (row) =>
        row.position === null ? (
          <span>
            <span aria-hidden="true">–</span>
            <span className="sr-only">fuori dalle finali</span>
          </span>
        ) : (
          <span className="inline-flex flex-wrap items-baseline gap-x-space-2">
            <span>{row.position}ª</span>
            {row.definitive ? null : (
              <span
                data-slot="posizione-non-definitiva"
                className="font-sans text-sm font-normal"
              >
                non ancora definitiva
              </span>
            )}
          </span>
        ),
    },
    {
      key: "points",
      header: "Punti",
      numeric: true,
      width: "18%",
      render: (row) => (
        <span className="inline-flex flex-wrap items-center justify-end gap-space-2">
          <span className="font-mono tabular-nums">{row.points}</span>
          {row.provisional ? <PuntiProvvisori /> : null}
        </span>
      ),
    },
  ];
}

function Dato({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col">
      <dt className="text-sm text-foreground">{label}</dt>
      <dd className="flex flex-wrap items-center gap-space-2">{children}</dd>
    </div>
  );
}

const numero = "font-mono text-3xl font-semibold tabular-nums";

/**
 * w-giocatore body (BLVS-50): the player's place, total and stages in one
 * category and season, then the points stage by stage with the gold or
 * silver final (★/◆ always with the word), each linking to the stage
 * standing. Kept current by the surrounding LiveProvider. A deleted
 * account shows «Giocatore anonimo» and nothing personal.
 */
export function SchedaGiocatore({
  standingsId,
  utenteId,
  categoria,
  stagione,
  me,
  reducedMotion,
}: {
  /** `<M|F>:<season>`: the overall standing of the snapshot to read. */
  standingsId: string;
  utenteId: string;
  categoria: Categoria;
  stagione: number;
  me: string | null;
  reducedMotion?: boolean;
}) {
  const { snapshot } = useLive();
  const ref = useRef<HTMLDivElement>(null);
  useLiveRowMotion(ref, reducedMotion);

  const standings = snapshot.overallStandings?.find(
    (s) => s.id === standingsId,
  );
  const row = rigaGiocatore(standings, utenteId);
  const indietro = (
    <p>
      <Link
        href={classificaHref(categoria, stagione)}
        className={linkClass}
        data-testid="torna-classifica"
      >
        <span aria-hidden="true">← </span>Classifica generale
      </Link>
    </p>
  );

  if (!row) {
    return (
      <div className="flex flex-col gap-stack" data-testid="scheda-giocatore">
        <p role="status">
          Il giocatore non è più in questa classifica: i risultati sono cambiati
          dopo l&apos;apertura della pagina.
        </p>
        {indietro}
      </div>
    );
  }

  const tappe = tappeGiocatore(row);
  const mio = row.playerId === me && !row.anonymous;

  return (
    <div
      className="flex flex-col gap-stack [&_dt]:text-foreground"
      data-testid="scheda-giocatore"
      {...(row.anonymous ? { "data-anonimo": "true" } : {})}
    >
      <h2
        className="font-heading text-2xl font-semibold [overflow-wrap:anywhere]"
        data-testid="scheda-nome"
      >
        {nomeGiocatore(row)}
      </h2>
      {row.anonymous ? (
        <p
          data-testid="scheda-anonimo"
          className="border-l-4 border-tape py-space-1 ps-space-3"
        >
          Account cancellato: i risultati restano nelle classifiche in forma
          anonima, senza dati personali.
        </p>
      ) : null}

      <section
        aria-labelledby="scheda-riepilogo"
        data-testid="scheda-riepilogo"
        className="flex flex-col gap-space-3 border-2 border-primary p-inset"
      >
        <h3
          id="scheda-riepilogo"
          className="flex flex-wrap items-center gap-space-2 font-heading text-lg font-semibold"
        >
          {stagioneLabel(stagione)} · {categoriaLabel(categoria)}
          {mio ? <BadgeTu /> : null}
        </h3>
        <dl className="flex flex-wrap gap-x-space-6 gap-y-space-3">
          <Dato label="Posizione">
            <span className={numero} data-testid="scheda-posizione">
              {row.position}ª
            </span>
            {row.tied ? (
              <span className="font-sans text-base">pari merito</span>
            ) : null}
          </Dato>
          <Dato label="Punti totali">
            <span className={numero} data-testid="scheda-punti">
              {row.points}
            </span>
            {row.provisional ? <PuntiProvvisori /> : null}
          </Dato>
          <Dato label="Tappe giocate">
            <span className={numero}>{row.stages}</span>
          </Dato>
        </dl>
        {row.provisional ? (
          <p className="text-sm">
            {puntiProvvisoriLabel(row.points)}: diventano definitivi quando
            l&apos;organizzazione chiude il tabellone di ogni tappa.
          </p>
        ) : null}
      </section>

      <div ref={ref}>
        <ResponsiveTable
          caption={`Punti per tappa · ${stagioneLabel(stagione)}`}
          columns={colonne(categoria)}
          rows={tappe}
          getRowKey={(t) => t.stageId}
          rowAttributes={(t) => ({
            ...liveRowAttributes(t.stageId, t),
            "data-testid": `tappa-${t.stageId}`,
            "data-punti": String(t.points),
          })}
          cardBadgeKey="position"
          emptyMessage="Nessuna tappa giocata in questa stagione."
        />
      </div>

      <p className="text-sm">
        Ogni tappa porta alla sua classifica. «Non in finale» vale 0 punti: il
        giocatore è uscito prima delle finali gold e silver.
      </p>

      {indietro}
    </div>
  );
}
