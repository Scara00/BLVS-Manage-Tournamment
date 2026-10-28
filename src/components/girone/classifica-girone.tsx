"use client";

import { Fragment, useRef } from "react";
import { NotaAssenza } from "@/components/live/nota-assenza";
import {
  liveRowAttributes,
  useLiveRowMotion,
} from "@/components/live/use-live-row-motion";
import {
  COLONNE_CLASSIFICA,
  diffLabel,
  type FasciaTaglio,
  type LineaDiTaglio,
  valoreColonna,
} from "@/lib/live/girone";
import type { LiveMe } from "@/lib/live/tappa";
import type { GroupStandingRow } from "@/lib/live/types";

export type ClassificaGironeProps = {
  /** «Girone A»: names the table and the list. */
  label: string;
  rows: readonly GroupStandingRow[];
  linea: LineaDiTaglio | null;
  me: LiveMe;
  /** Forces reduced motion (stories, tests). */
  reducedMotion?: boolean;
};

function rowKey(row: GroupStandingRow) {
  return row.playerId ?? row.pair;
}

/** «★ Gold», with the symbol hidden from screen readers (the word says it). */
function Fascia({ fascia }: { fascia: FasciaTaglio }) {
  return (
    <span className="whitespace-nowrap">
      <span aria-hidden="true">{fascia.simbolo} </span>
      {fascia.testo}
    </span>
  );
}

/** The cut line as text: what is above it and what is below. */
function TestoLinea({ linea }: { linea: LineaDiTaglio }) {
  return (
    <span className="flex flex-wrap items-center gap-x-space-4 gap-y-space-1 font-heading text-sm font-semibold tracking-wide uppercase">
      <span className="sr-only">Linea di taglio.</span>
      <span>
        <span aria-hidden="true">▲ </span>
        <span className="sr-only">Sopra la linea: </span>
        <Fascia fascia={linea.sopra} />
      </span>
      {linea.sotto ? (
        <span>
          <span aria-hidden="true">▼ </span>
          <span className="sr-only">Sotto la linea: </span>
          <Fascia fascia={linea.sotto} />
        </span>
      ) : null}
      {linea.aCavallo ? (
        <span className="font-body text-sm font-normal tracking-normal normal-case">
          Parità sulla linea: decide l’organizzazione.
        </span>
      ) : null}
    </span>
  );
}

function Nome({ row, me }: { row: GroupStandingRow; me: LiveMe }) {
  return (
    <span className="inline-flex flex-wrap items-center gap-space-2 [overflow-wrap:anywhere]">
      {row.pair}
      {row.note ? <NotaAssenza nota={row.note} /> : null}
      {row.playerId === me ? (
        <span className="bg-primary px-space-2 font-heading text-xs font-semibold tracking-wider text-primary-foreground uppercase">
          Tu
        </span>
      ) : null}
    </span>
  );
}

function attributiRiga(
  row: GroupStandingRow,
  index: number,
  linea: LineaDiTaglio | null,
  me: LiveMe,
): Record<`data-${string}`, string> {
  const fascia = linea
    ? index < linea.dopo
      ? "sopra"
      : linea.sotto
        ? "sotto"
        : "fuori"
    : null;
  return {
    ...liveRowAttributes(rowKey(row), row),
    ...(fascia ? { "data-fascia": fascia } : {}),
    ...(row.playerId === me ? { "data-mia": "true" } : {}),
  };
}

/**
 * The full standing of a group (w-girone, R-36): a table from `md` up, a
 * list of cards with position, name, wins and difference below. The cut
 * line is text on a tape rule. Rows are never live regions; changed rows
 * flash and moved rows slide, except with reduced motion.
 */
export function ClassificaGirone({
  label,
  rows,
  linea,
  me,
  reducedMotion,
}: ClassificaGironeProps) {
  const ref = useRef<HTMLDivElement>(null);
  useLiveRowMotion(ref, reducedMotion);
  const caption = `Classifica ${label}`;

  if (rows.length === 0) {
    return (
      <p className="border border-border p-inset">
        La classifica compare dopo il primo risultato del girone.
      </p>
    );
  }

  const colonne = COLONNE_CLASSIFICA.length + 2;
  return (
    <div
      ref={ref}
      data-testid="girone-classifica"
      className="w-full min-w-0 [&_[data-mia=true]]:bg-tape-soft"
    >
      <table className="hidden w-full table-fixed border-collapse text-start md:table">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr className="border-b-2 border-primary">
            <th
              scope="col"
              style={{ width: "10%" }}
              className="px-space-3 py-space-2 text-start align-bottom font-heading text-sm font-semibold"
            >
              <abbr
                title="Posizione"
                aria-hidden="true"
                className="no-underline"
              >
                Pos.
              </abbr>
              <span className="sr-only">Posizione</span>
            </th>
            <th
              scope="col"
              className="px-space-3 py-space-2 text-start align-bottom font-heading text-sm font-semibold"
            >
              Giocatore
            </th>
            {COLONNE_CLASSIFICA.map((c) => (
              <th
                key={c.key}
                scope="col"
                style={{ width: "10%" }}
                className="px-space-3 py-space-2 text-end align-bottom font-heading text-sm font-semibold"
              >
                <abbr
                  title={c.nome}
                  aria-hidden="true"
                  className="no-underline"
                >
                  {c.abbr}
                </abbr>
                <span className="sr-only">{c.nome}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <Fragment key={rowKey(row)}>
              <tr
                {...attributiRiga(row, i, linea, me)}
                className="border-b border-border"
              >
                <td className="px-space-3 py-space-3 text-start align-top font-mono font-semibold tabular-nums">
                  {row.position}
                </td>
                <th
                  scope="row"
                  className="px-space-3 py-space-3 text-start align-top font-heading font-semibold break-words"
                >
                  <Nome row={row} me={me} />
                </th>
                {COLONNE_CLASSIFICA.map((c) => (
                  <td
                    key={c.key}
                    className="px-space-3 py-space-3 text-end align-top font-mono tabular-nums"
                  >
                    {valoreColonna(row, c.key)}
                  </td>
                ))}
              </tr>
              {linea && i === linea.dopo - 1 ? (
                <tr data-slot="linea-taglio" className="border-y-4 border-tape">
                  <td
                    colSpan={colonne}
                    className="bg-tape px-space-3 py-space-1 text-primary"
                  >
                    <TestoLinea linea={linea} />
                  </td>
                </tr>
              ) : null}
            </Fragment>
          ))}
        </tbody>
      </table>

      <ol aria-label={caption} className="flex flex-col gap-stack-sm md:hidden">
        {rows.map((row, i) => (
          <Fragment key={rowKey(row)}>
            <li
              {...attributiRiga(row, i, linea, me)}
              className="flex flex-wrap items-start gap-x-space-3 gap-y-space-2 border border-border bg-card p-inset"
            >
              <p className="inline-flex min-h-10 min-w-10 shrink-0 items-center justify-center bg-primary px-space-2 font-mono font-semibold text-primary-foreground tabular-nums">
                <span className="sr-only">Posizione </span>
                {row.position}
              </p>
              <p className="min-w-0 flex-1 self-center font-heading text-lg font-semibold">
                <Nome row={row} me={me} />
              </p>
              <dl className="flex w-full gap-x-space-6 text-foreground">
                <div className="flex items-baseline gap-space-2">
                  <dt>Vittorie</dt>
                  <dd className="font-mono font-semibold tabular-nums">
                    {row.won}
                  </dd>
                </div>
                <div className="flex items-baseline gap-space-2">
                  <dt>
                    <abbr
                      title="Differenza punti"
                      aria-hidden="true"
                      className="no-underline"
                    >
                      Diff.
                    </abbr>
                    <span className="sr-only">Differenza punti</span>
                  </dt>
                  <dd className="font-mono font-semibold tabular-nums">
                    {diffLabel(row.diff)}
                  </dd>
                </div>
              </dl>
            </li>
            {linea && i === linea.dopo - 1 ? (
              <li
                data-slot="linea-taglio"
                className="border-y-4 border-tape bg-tape px-space-3 py-space-1 text-primary"
              >
                <TestoLinea linea={linea} />
              </li>
            ) : null}
          </Fragment>
        ))}
      </ol>

      {/* The headers already say the full names to screen readers. */}
      <p
        aria-hidden="true"
        className="mt-space-3 hidden flex-wrap gap-x-space-4 gap-y-space-1 text-sm md:flex"
      >
        {COLONNE_CLASSIFICA.map((c) => (
          <span key={c.key}>
            <span className="font-mono font-semibold">{c.abbr}</span>{" "}
            {c.nome.toLowerCase()}
          </span>
        ))}
      </p>
    </div>
  );
}
