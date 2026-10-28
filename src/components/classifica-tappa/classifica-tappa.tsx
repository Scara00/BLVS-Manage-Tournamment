"use client";

import { Fragment, useRef } from "react";
import { BadgeTu, PuntiProvvisori } from "@/components/classifica-generale";
import { useLive } from "@/components/live/live-provider";
import {
  liveRowAttributes,
  useLiveRowMotion,
} from "@/components/live/use-live-row-motion";
import {
  ResponsiveTable,
  type ResponsiveTableColumn,
} from "@/components/responsive-table/responsive-table";
import { FlipDigits, useReducedMotion } from "@/components/scoreboard";
import type { Categoria, FaseTabellone } from "@/lib/db/types";
import type { StageStandingRow, StageStandings } from "@/lib/live/types";
import {
  classificaMostrata,
  FASE_FINALE_LABEL,
  puntiPerPosizioneTesto,
  titoloClassificaTappa,
} from "@/lib/tappe/classifica/live";
import { LaTuaTappa } from "./la-tua-tappa";

const STATO_TESTO: Record<StageStandings["state"], string> = {
  in_attesa:
    "Le finali non sono ancora iniziate: la classifica si riempie con le finali gold e silver.",
  in_corso:
    "Finali in corso: le posizioni segnate «non ancora definitiva» possono ancora cambiare.",
  definitiva:
    "Tutte le posizioni sono decise: i punti restano provvisori finché l'organizzazione chiude il tabellone.",
  conclusa: "Tabellone chiuso: i punti sono definitivi.",
};

/** Points in font.mono: split-flap digits, plain digits with reduced motion. */
function Punti({
  punti,
  provvisori,
  still,
}: {
  punti: number | null;
  provvisori: boolean;
  still: boolean;
}) {
  return (
    <span className="inline-flex flex-wrap items-center justify-end gap-space-2">
      {punti === null ? (
        <span>
          <span aria-hidden="true">–</span>
          <span className="sr-only">punti non ancora assegnati</span>
        </span>
      ) : still ? (
        <span data-slot="punti-cifre" className="font-mono tabular-nums">
          {punti}
        </span>
      ) : (
        <FlipDigits
          value={punti}
          minDigits={2}
          pad="blank"
          reducedMotion={false}
        />
      )}
      {provvisori && punti !== null ? <PuntiProvvisori /> : null}
    </span>
  );
}

function colonne(
  me: string | null,
  provvisori: boolean,
  still: boolean,
  pari: (row: StageStandingRow) => boolean,
): ResponsiveTableColumn<StageStandingRow>[] {
  return [
    {
      key: "position",
      header: "Posizione",
      numeric: true,
      align: "start",
      width: "26%",
      render: (row) => (
        <span className="inline-flex flex-wrap items-baseline gap-x-space-2">
          <span>{row.position}</span>
          {pari(row) ? <span className="sr-only"> a pari merito</span> : null}
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
      key: "name",
      header: "Giocatore",
      rowHeader: true,
      render: (row) => (
        <span className="inline-flex flex-wrap items-center gap-x-space-2 gap-y-space-1">
          <span>{row.name}</span>
          {row.playerId === me ? <BadgeTu /> : null}
          {row.withdrawn ? (
            <span className="font-sans text-sm font-normal">(ritirato)</span>
          ) : null}
          {row.toResolve ? (
            <span className="font-sans text-sm font-normal">
              (parità da risolvere)
            </span>
          ) : null}
        </span>
      ),
    },
    {
      key: "points",
      header: "Punti",
      numeric: true,
      width: "30%",
      render: (row) => (
        <Punti punti={row.points} provvisori={provvisori} still={still} />
      ),
    },
  ];
}

type Gruppo = { key: string; caption: string; rows: StageStandingRow[] };

/** Gold final, then silver, then (rarely) a final of unknown phase. */
function gruppi(rows: readonly StageStandingRow[]): Gruppo[] {
  const fasi: (FaseTabellone | null)[] = ["gold", "silver", null];
  return fasi
    .map((fase) => ({
      key: fase ?? "altra",
      caption: fase
        ? `${FASE_FINALE_LABEL[fase]} · punti ${puntiPerPosizioneTesto(fase)}`
        : "Finale",
      rows: rows.filter((r) => r.phase === fase),
    }))
    .filter((g) => g.rows.length > 0);
}

/**
 * w-classifica-tappa body (BLVS-49): «La tua tappa», the state as text and
 * one table per final (gold, then silver, separated by a line), kept
 * current by the surrounding LiveProvider. Rows that change flash (tape)
 * and the points flip, except with reduced motion.
 */
export function ClassificaTappa({
  standingsId,
  categoria,
  me,
  mostraLaTuaTappa,
  reducedMotion,
}: {
  /** `<stage>:<M|F>`: which standing of the snapshot to show. */
  standingsId: string;
  categoria: Categoria;
  me: string | null;
  /** The player is registered on this board. */
  mostraLaTuaTappa: boolean;
  reducedMotion?: boolean;
}) {
  const { snapshot } = useLive();
  const ref = useRef<HTMLDivElement>(null);
  const still = useReducedMotion(reducedMotion);
  useLiveRowMotion(ref, reducedMotion);

  const standings = classificaMostrata(
    snapshot.stageStandings?.find((s) => s.id === standingsId),
    (snapshot.closed ?? []).some((c) => c.id === standingsId),
  );
  const rows = standings?.rows ?? [];
  const provvisori = standings?.provisional ?? true;
  const stato = standings?.state ?? "in_attesa";
  const pari = (row: StageStandingRow) =>
    rows.some(
      (r) => r.playerId !== row.playerId && r.position === row.position,
    );
  const columns = colonne(me, provvisori, still, pari);
  const elenco = gruppi(rows);

  return (
    <div
      className="flex flex-col gap-stack"
      data-testid="classifica-tappa"
      data-stato={stato}
    >
      {mostraLaTuaTappa ? <LaTuaTappa standings={standings} me={me} /> : null}

      <h2 className="font-heading text-2xl font-semibold">
        {titoloClassificaTappa(categoria)}
      </h2>
      <p data-testid="classifica-tappa-stato">{STATO_TESTO[stato]}</p>
      {provvisori && rows.length > 0 ? (
        <p className="text-sm">
          I punti sono provvisori finché il tabellone non è chiuso: lo indica la
          scritta «provvisori» accanto ai punti.
        </p>
      ) : null}

      <div ref={ref} className="flex flex-col gap-stack [&_dt]:text-foreground">
        {elenco.length === 0 ? (
          <p className="border border-border p-inset">
            Ancora nessun giocatore in finale.
          </p>
        ) : (
          elenco.map((g, i) => (
            <Fragment key={g.key}>
              {i > 0 ? (
                <hr
                  data-slot="separatore-finali"
                  className="border-0 border-t-4 border-primary"
                />
              ) : null}
              <ResponsiveTable
                caption={g.caption}
                columns={columns}
                rows={g.rows}
                getRowKey={(row) => row.playerId}
                rowAttributes={(row) => ({
                  ...liveRowAttributes(row.playerId, { ...row, provvisori }),
                  "data-testid": `riga-${row.playerId}`,
                  "data-fase": row.phase ?? "",
                  "data-punti": String(row.points ?? ""),
                  ...(row.playerId === me ? { "data-mia": "true" } : {}),
                })}
                cardBadgeKey="position"
              />
            </Fragment>
          ))
        )}
      </div>

      <details className="border border-border p-inset">
        <summary className="cursor-pointer font-heading font-semibold focus-ring">
          Punti per posizione
        </summary>
        <ul className="mt-space-3 flex flex-col gap-space-2">
          {(["gold", "silver"] as const).map((fase) => (
            <li key={fase}>
              {FASE_FINALE_LABEL[fase]}:{" "}
              <span className="font-mono tabular-nums">
                {puntiPerPosizioneTesto(fase)}
              </span>{" "}
              punti, dal 1º al 4º posto.
            </li>
          ))}
          <li>Chi esce prima delle finali non prende punti in questa tappa.</li>
        </ul>
      </details>
    </div>
  );
}
