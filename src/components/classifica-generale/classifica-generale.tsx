"use client";

import { useId, useRef, useState } from "react";
import {
  ResponsiveTable,
  type ResponsiveTableColumn,
} from "@/components/responsive-table/responsive-table";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { useLive } from "@/components/live/live-provider";
import {
  liveRowAttributes,
  useLiveRowMotion,
} from "@/components/live/use-live-row-motion";
import { titoloClassifica } from "@/lib/classifica-generale/annuncio";
import {
  filtraPerNome,
  risultatiRicercaLabel,
} from "@/lib/classifica-generale/ricerca";
import { spiegaRegolaGenerale } from "@/lib/classifica-generale/spareggi";
import { stagioneLabel } from "@/lib/classifica-generale/stagione";
import type { Categoria } from "@/lib/db/types";
import type { OverallPlayerRow } from "@/lib/live/types";
import { LaTuaPosizione } from "./la-tua-posizione";
import { NomeGiocatore, PuntiGiocatore } from "./riga-giocatore";

function colonne(me: string | null): ResponsiveTableColumn<OverallPlayerRow>[] {
  return [
    {
      key: "position",
      header: "Posizione",
      numeric: true,
      align: "start",
      width: "16%",
      render: (row) => (
        <>
          {row.position}
          {row.tied ? <span className="sr-only"> a pari merito</span> : null}
        </>
      ),
    },
    {
      key: "name",
      header: "Giocatore",
      rowHeader: true,
      render: (row) => <NomeGiocatore row={row} mio={row.playerId === me} />,
    },
    { key: "stages", header: "Tappe giocate", numeric: true, width: "18%" },
    {
      key: "points",
      header: "Punti",
      numeric: true,
      width: "24%",
      render: (row) => <PuntiGiocatore row={row} />,
    },
  ];
}

/**
 * w-classifica body: «La tua posizione», the name search and the table of
 * one category and season, kept current by the surrounding LiveProvider.
 * Rows that change flash and slide (tape), except with reduced motion.
 */
export function ClassificaGenerale({
  standingsId,
  categoria,
  stagione,
  me,
  reducedMotion,
}: {
  /** `<M|F>:<season>`: which standing of the snapshot to show. */
  standingsId: string;
  categoria: Categoria;
  stagione: number | null;
  me: string | null;
  reducedMotion?: boolean;
}) {
  const { snapshot } = useLive();
  const [query, setQuery] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  const statusId = useId();
  useLiveRowMotion(ref, reducedMotion);

  const standings = snapshot.overallStandings?.find(
    (s) => s.id === standingsId,
  );
  const rows = standings?.rows ?? [];
  const mia = me ? rows.find((r) => r.playerId === me) : undefined;
  const visibili = filtraPerNome(rows, query, (r) => r.name);
  const esito = risultatiRicercaLabel(visibili.length, query);
  const provvisori = rows.some((r) => r.provisional);

  return (
    <div className="flex flex-col gap-stack" data-testid="classifica-generale">
      <LaTuaPosizione me={me} row={mia} />

      {rows.length > 0 ? (
        <form
          role="search"
          aria-label="Cerca nella classifica"
          className="flex flex-col gap-space-2"
          onSubmit={(event) => event.preventDefault()}
        >
          <Field label="Cerca per nome" className="max-w-md">
            <Input
              type="search"
              name="q"
              autoComplete="off"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              aria-describedby={statusId}
            />
          </Field>
          <p id={statusId} role="status" className="text-sm">
            {esito}
          </p>
        </form>
      ) : null}

      {provvisori ? (
        <p className="flex flex-wrap items-center gap-space-2 text-sm">
          I punti delle tappe ancora aperte sono provvisori: lo indica la
          scritta «provvisori» accanto ai punti.
        </p>
      ) : null}

      <div ref={ref}>
        <ResponsiveTable
          caption={`${titoloClassifica(categoria)} · ${stagioneLabel(stagione)}`}
          columns={colonne(me)}
          rows={visibili}
          getRowKey={(row) => row.playerId}
          rowAttributes={(row) => ({
            ...liveRowAttributes(row.playerId, row),
            "data-testid": `riga-${row.playerId}`,
            ...(row.playerId === me ? { "data-mia": "true" } : {}),
          })}
          cardBadgeKey="position"
          emptyMessage={
            rows.length === 0
              ? "Nessun giocatore in classifica: la classifica si riempie dopo le prime partite della stagione."
              : "Nessun giocatore con questo nome."
          }
        />
      </div>

      <details className="border border-border p-inset">
        <summary className="cursor-pointer font-heading font-semibold focus-ring">
          Come si calcola la classifica
        </summary>
        <ol className="mt-space-3 flex list-decimal flex-col gap-space-2 ps-space-5">
          {spiegaRegolaGenerale().map((testo) => (
            <li key={testo}>{testo}</li>
          ))}
        </ol>
      </details>
    </div>
  );
}
