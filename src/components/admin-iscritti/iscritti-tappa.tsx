"use client";

import { ArrowLeftIcon, InfoIcon, UserMinusIcon } from "lucide-react";
import Link from "next/link";
import { useCallback, useRef, useState } from "react";
import { StatoTappaBadge } from "@/components/admin-tappa/stato-badge";
import {
  ResponsiveTable,
  type ResponsiveTableColumn,
} from "@/components/responsive-table/responsive-table";
import { Button } from "@/components/ui/button";
import type { Categoria } from "@/lib/db/types";
import type {
  CercaGiocatoriAction,
  IscrittiTabelloneView,
  IscrittiTappaView,
  IscrittoView,
  ModificaIscrittiAction,
} from "@/lib/iscrizioni/admin/types";
import { gestioneTappaPath } from "@/lib/tappe/gestione-state";
import {
  AggiungiGiocatoreDialog,
  type Ricerca,
} from "./aggiungi-giocatore-dialog";
import { EsportaCsv } from "./esporta-csv";
import {
  RimuoviIscrittoDialog,
  type DaRimuovere,
} from "./rimuovi-iscritto-dialog";

type IscrittiTappaProps = {
  tappa: IscrittiTappaView;
  /** Server actions, passed in by the page (fakes in Storybook). */
  aggiungi: ModificaIscrittiAction;
  rimuovi: ModificaIscrittiAction;
  cerca: CercaGiocatoriAction;
  /** Storybook: the add dialog open with a query and its result. */
  aggiungiAperto?: boolean;
  queryIniziale?: string;
  ricercaIniziale?: Ricerca;
  /** Storybook: the removal confirmation open for this registration. */
  rimuoviAperto?: string;
};

function esitoId(categoria: Categoria) {
  return `iscritti-esito-${categoria}`;
}

function colonne(
  modificabile: boolean,
  onRimuovi: (iscritto: IscrittoView, button: HTMLElement) => void,
): ResponsiveTableColumn<IscrittoView>[] {
  const base: ResponsiveTableColumn<IscrittoView>[] = [
    {
      key: "posto",
      header: "Posto",
      numeric: true,
      width: "10%",
      render: (row) => (row.posto === null ? "–" : row.posto),
    },
    {
      key: "nome",
      header: "Giocatore",
      rowHeader: true,
      render: (row) => (
        <span className="flex flex-col">
          <span>{row.nome}</span>
          <span className="font-sans text-sm font-normal text-muted-foreground">
            {row.email}
          </span>
        </span>
      ),
    },
    {
      key: "iscrittoIl",
      header: "Iscritto il",
      numeric: true,
      align: "start",
      width: "22%",
      render: (row) => (
        <time dateTime={row.iscrittoIl}>{row.iscrittoIlTesto}</time>
      ),
    },
    { key: "statoLabel", header: "Stato", width: "15%" },
  ];
  if (!modificabile) return base;
  return [
    ...base,
    {
      key: "azioni",
      header: "Azioni",
      width: "25%",
      render: (row) => (
        <Button
          variant="secondary"
          className="max-w-full"
          aria-label={`Rimuovi ${row.nome}`}
          onClick={(event) => onRimuovi(row, event.currentTarget)}
        >
          <UserMinusIcon aria-hidden className="size-4" />
          {/* Icon only in the narrower table up to xl (200 % text). */}
          <span className="lg:max-xl:sr-only">Rimuovi</span>
        </Button>
      ),
    },
  ];
}

function Tabellone({
  tabellone,
  modificabile,
  esito,
  onRimuovi,
}: {
  tabellone: IscrittiTabelloneView;
  modificabile: boolean;
  esito: string | undefined;
  onRimuovi: (iscritto: IscrittoView, button: HTMLElement) => void;
}) {
  const titoloId = `tabellone-${tabellone.categoria}-titolo`;
  return (
    <section
      aria-labelledby={titoloId}
      data-testid={`tabellone-${tabellone.categoria}`}
      className="flex flex-col gap-stack-sm"
    >
      <div className="flex flex-wrap items-center justify-between gap-space-3">
        <h2 id={titoloId} className="font-heading text-xl font-semibold">
          Tabellone {tabellone.label.toLowerCase()}
        </h2>
        <p
          data-testid="posti-liberi"
          className="bg-tape px-space-3 py-space-1 font-heading font-semibold tracking-wider [overflow-wrap:anywhere] text-primary uppercase"
        >
          {tabellone.liberiTesto}
        </p>
      </div>
      <p>
        <span className="font-mono tabular-nums">{tabellone.occupati}</span>{" "}
        {tabellone.occupati === 1 ? "iscritto" : "iscritti"} su{" "}
        <span className="font-mono tabular-nums">{tabellone.posti}</span> posti
      </p>
      <p
        id={esitoId(tabellone.categoria)}
        tabIndex={-1}
        data-testid="iscritti-esito"
        className="self-start font-medium focus-ring empty:hidden"
      >
        {esito}
      </p>
      <ResponsiveTable
        caption={`Iscritti al tabellone ${tabellone.label.toLowerCase()}`}
        captionHidden
        columns={colonne(modificabile, onRimuovi)}
        rows={tabellone.iscritti}
        getRowKey={(row) => row.id}
        cardBadgeKey="posto"
        rowAttributes={(row) => ({ "data-iscrizione": row.id })}
        stackBelow="lg"
        emptyMessage="Nessun iscritto in questo tabellone."
      />
    </section>
  );
}

/**
 * w-admin-iscritti: the active registrants of a stage per board (seat,
 * name, date in mono), the free seats in words, «Aggiungi giocatore»
 * (w-admin-aggiungi-giocatore), «Rimuovi» behind a confirmation and the
 * CSV export. Cancelled, archived, running and finished stages are
 * read-only; the export stays.
 */
export function IscrittiTappa({
  tappa,
  aggiungi,
  rimuovi,
  cerca,
  aggiungiAperto,
  queryIniziale,
  ricercaIniziale,
  rimuoviAperto,
}: IscrittiTappaProps) {
  const trova = (id: string | undefined): DaRimuovere | null => {
    for (const t of tappa.tabelloni) {
      const iscritto = t.iscritti.find((i) => i.id === id);
      if (iscritto)
        return { iscritto, tabellone: t.label, esitoId: esitoId(t.categoria) };
    }
    return null;
  };
  const [target, setTarget] = useState<DaRimuovere | null>(() =>
    trova(rimuoviAperto),
  );
  const [esiti, setEsiti] = useState<Partial<Record<Categoria, string>>>({});
  const returnFocus = useRef<HTMLElement | null>(null);
  const categoriaTarget = useRef<Categoria | null>(null);

  const onRimuovi = useCallback(
    (iscritto: IscrittoView, button: HTMLElement) => {
      returnFocus.current = button;
      for (const t of tappa.tabelloni) {
        if (t.iscritti.some((i) => i.id === iscritto.id)) {
          categoriaTarget.current = t.categoria;
          setTarget({
            iscritto,
            tabellone: t.label,
            esitoId: esitoId(t.categoria),
          });
        }
      }
    },
    [tappa.tabelloni],
  );

  const onClose = useCallback(
    ({ rimosso, message }: { rimosso: boolean; message?: string }) => {
      const categoria = categoriaTarget.current;
      if (rimosso && categoria && message) {
        setEsiti((prev) => ({ ...prev, [categoria]: message }));
      }
      setTarget(null);
    },
    [],
  );

  return (
    <div className="flex flex-col gap-stack-lg" data-testid="iscritti-tappa">
      <section
        aria-labelledby="iscritti-tappa-nome"
        className="flex flex-col gap-stack-sm"
      >
        <h2
          id="iscritti-tappa-nome"
          className="font-heading text-2xl font-semibold text-balance [overflow-wrap:anywhere]"
        >
          {tappa.nome}
        </h2>
        <div className="flex flex-wrap items-center gap-space-3">
          <span>{tappa.periodo}</span>
          <StatoTappaBadge stato={tappa.stato} />
        </div>
        {tappa.notaSolaLettura ? (
          <p className="flex items-start gap-space-2 border-2 border-input p-inset">
            <InfoIcon aria-hidden className="mt-1 size-4 shrink-0" />
            {tappa.notaSolaLettura}
          </p>
        ) : null}
        <div className="flex flex-wrap gap-space-3">
          {tappa.modificabile ? (
            <AggiungiGiocatoreDialog
              tappaId={tappa.id}
              tabelloni={tappa.tabelloni}
              cerca={cerca}
              action={aggiungi}
              defaultOpen={aggiungiAperto}
              initialQuery={queryIniziale}
              initialRicerca={ricercaIniziale}
            />
          ) : null}
          <EsportaCsv tappa={tappa} />
        </div>
      </section>

      {tappa.tabelloni.map((tabellone) => (
        <Tabellone
          key={tabellone.categoria}
          tabellone={tabellone}
          modificabile={tappa.modificabile}
          esito={esiti[tabellone.categoria]}
          onRimuovi={onRimuovi}
        />
      ))}

      {tappa.modificabile ? (
        <RimuoviIscrittoDialog
          tappaId={tappa.id}
          target={target}
          onClose={onClose}
          returnFocus={returnFocus}
          action={rimuovi}
        />
      ) : null}

      <Link
        href={gestioneTappaPath(tappa.id)}
        className="inline-flex items-center gap-space-2 self-start font-heading font-semibold underline decoration-2 underline-offset-4 focus-ring"
      >
        <ArrowLeftIcon aria-hidden className="size-4" />
        Torna alla tappa
      </Link>
    </div>
  );
}
