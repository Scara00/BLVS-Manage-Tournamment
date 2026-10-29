"use client";

import {
  ArrowLeftIcon,
  CheckIcon,
  InfoIcon,
  UserMinusIcon,
} from "lucide-react";
import Link from "next/link";
import {
  startTransition,
  useActionState,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { StatoTappaBadge } from "@/components/admin-tappa/stato-badge";
import {
  ResponsiveTable,
  type ResponsiveTableColumn,
} from "@/components/responsive-table/responsive-table";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import type { Categoria } from "@/lib/db/types";
import {
  initialModificaIscrittiState,
  type CercaGiocatoriAction,
  type IscrittiTabelloneView,
  type IscrittiTappaView,
  type IscrittoView,
  type ModificaIscrittiAction,
  type ModificaIscrittiState,
} from "@/lib/iscrizioni/admin/types";
import { gestioneTappaPath } from "@/lib/tappe/gestione-state";
import { cn } from "@/lib/utils";
import {
  AggiungiGiocatoreDialog,
  type Ricerca,
} from "./aggiungi-giocatore-dialog";
import { ConfermaTutteDialog } from "./conferma-tutte-dialog";
import { EsportaCsv } from "./esporta-csv";
import {
  RimuoviIscrittoDialog,
  type DaRimuovere,
} from "./rimuovi-iscritto-dialog";
import { useAzioneIscritti } from "./use-azione-iscritti";

type IscrittiTappaProps = {
  tappa: IscrittiTappaView;
  /** Server actions, passed in by the page (fakes in Storybook). */
  aggiungi: ModificaIscrittiAction;
  rimuovi: ModificaIscrittiAction;
  conferma: ModificaIscrittiAction;
  cerca: CercaGiocatoriAction;
  /** Storybook: the add dialog open with a query and its result. */
  aggiungiAperto?: boolean;
  queryIniziale?: string;
  ricercaIniziale?: Ricerca;
  /** Storybook: the removal confirmation open for this registration. */
  rimuoviAperto?: string;
  /** Storybook: «Conferma tutte» open. */
  confermaTutteAperto?: boolean;
};

/** The message under a board's heading, after an action on one of its rows. */
type Esito = { message: string; errore: boolean };

function esitoId(categoria: Categoria) {
  return `iscritti-esito-${categoria}`;
}

/** Where «Conferma tutte» writes its outcome. */
const ESITO_TUTTE_ID = "iscritti-esito-tutte";

function inAttesaDi(iscritti: readonly IscrittoView[]) {
  return iscritti.filter((i) => i.stato === "in_attesa").length;
}

function colonne(
  modificabile: boolean,
  onRimuovi: (iscritto: IscrittoView, button: HTMLElement) => void,
  onConferma: (iscritto: IscrittoView) => void,
  inConferma: string | null,
  /** A row has «Conferma» too: the actions column takes more room. */
  dueAzioni: boolean,
): ResponsiveTableColumn<IscrittoView>[] {
  const base: ResponsiveTableColumn<IscrittoView>[] = [
    {
      key: "posto",
      header: "Posto",
      numeric: true,
      width: dueAzioni ? "8%" : "10%",
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
      width: dueAzioni ? "20%" : "22%",
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
      // «Conferma» and «Rimuovi» side by side on a pending row.
      width: dueAzioni ? "34%" : "25%",
      render: (row) => (
        <div className="flex flex-wrap gap-space-2">
          {row.stato === "in_attesa" ? (
            <Button
              variant="secondary"
              className="max-w-full"
              aria-label={`Conferma ${row.nome}`}
              loading={inConferma === row.id}
              onClick={() => onConferma(row)}
            >
              <CheckIcon aria-hidden className="size-4" />
              <span className="lg:max-xl:sr-only">Conferma</span>
            </Button>
          ) : null}
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
        </div>
      ),
    },
  ];
}

function Tabellone({
  tabellone,
  modificabile,
  esito,
  onRimuovi,
  onConferma,
  inConferma,
}: {
  tabellone: IscrittiTabelloneView;
  modificabile: boolean;
  esito: Esito | undefined;
  onRimuovi: (iscritto: IscrittoView, button: HTMLElement) => void;
  onConferma: (iscritto: IscrittoView) => void;
  inConferma: string | null;
}) {
  const titoloId = `tabellone-${tabellone.categoria}-titolo`;
  const inAttesa = inAttesaDi(tabellone.iscritti);
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
        {inAttesa > 0 ? (
          <>
            {" · "}
            <span
              data-testid="in-attesa"
              className="font-mono font-semibold tabular-nums"
            >
              {inAttesa}
            </span>{" "}
            in attesa di conferma
          </>
        ) : null}
      </p>
      <p
        id={esitoId(tabellone.categoria)}
        tabIndex={-1}
        role={esito?.errore ? "alert" : undefined}
        data-testid="iscritti-esito"
        className={cn(
          "self-start font-medium focus-ring empty:hidden",
          esito?.errore && "text-error-fg",
        )}
      >
        {esito?.message}
      </p>
      <ResponsiveTable
        caption={`Iscritti al tabellone ${tabellone.label.toLowerCase()}`}
        captionHidden
        columns={colonne(
          modificabile,
          onRimuovi,
          onConferma,
          inConferma,
          modificabile && inAttesa > 0,
        )}
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
 * (w-admin-aggiungi-giocatore), «Conferma» on each pending registration
 * and «Conferma tutte» (only confirmed ones go into the groups), «Rimuovi»
 * behind a confirmation and the CSV export. Cancelled, archived, running
 * and finished stages are read-only; the export stays.
 */
export function IscrittiTappa({
  tappa,
  aggiungi,
  rimuovi,
  conferma,
  cerca,
  aggiungiAperto,
  queryIniziale,
  ricercaIniziale,
  rimuoviAperto,
  confermaTutteAperto,
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
  const [esiti, setEsiti] = useState<Partial<Record<Categoria, Esito>>>({});
  const [esitoTutte, setEsitoTutte] = useState<string | null>(null);
  const returnFocus = useRef<HTMLElement | null>(null);
  const categoriaTarget = useRef<Categoria | null>(null);
  const toast = useToast();
  const inAttesa = tappa.tabelloni.reduce(
    (n, t) => n + inAttesaDi(t.iscritti),
    0,
  );

  // «Conferma» on a row. The state lives here, not in the row: a confirmed
  // row loses its button in the refresh that brings the outcome.
  const azioneConferma = useAzioneIscritti(conferma);
  const [statoConferma, confermaFormAction] = useActionState(
    azioneConferma,
    initialModificaIscrittiState,
  );
  const [inConferma, setInConferma] = useState<{
    id: string;
    categoria: Categoria;
  } | null>(null);
  const [confermaVista, setConfermaVista] = useState(statoConferma);
  if (statoConferma !== confermaVista) {
    setConfermaVista(statoConferma);
    if (statoConferma.status !== "idle" && inConferma) {
      const categoria = inConferma.categoria;
      setEsiti((prev) => ({
        ...prev,
        [categoria]: {
          message: statoConferma.message,
          errore: statoConferma.status === "error",
        },
      }));
      setInConferma(null);
    }
  }
  const confermaGestita = useRef<ModificaIscrittiState | null>(null);
  const categoriaConferma = useRef<Categoria | null>(null);
  useEffect(() => {
    if (
      statoConferma.status === "idle" ||
      confermaGestita.current === statoConferma
    )
      return;
    confermaGestita.current = statoConferma;
    if (statoConferma.status === "success")
      toast.add({ title: statoConferma.message });
    // After a success the row's button is gone: focus the board's message.
    const categoria = categoriaConferma.current;
    if (categoria) document.getElementById(esitoId(categoria))?.focus();
  }, [statoConferma, toast]);

  const onConferma = useCallback(
    (iscritto: IscrittoView) => {
      const tabellone = tappa.tabelloni.find((t) =>
        t.iscritti.some((i) => i.id === iscritto.id),
      );
      if (!tabellone) return;
      categoriaConferma.current = tabellone.categoria;
      setInConferma({ id: iscritto.id, categoria: tabellone.categoria });
      const formData = new FormData();
      formData.set("tappaId", tappa.id);
      formData.set("iscrizioneId", iscritto.id);
      formData.set("nome", iscritto.nome);
      startTransition(() => confermaFormAction(formData));
    },
    [tappa.id, tappa.tabelloni, confermaFormAction],
  );

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
        setEsiti((prev) => ({
          ...prev,
          [categoria]: { message, errore: false },
        }));
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
            <ConfermaTutteDialog
              tappaId={tappa.id}
              inAttesa={inAttesa}
              action={conferma}
              esitoId={ESITO_TUTTE_ID}
              onEsito={setEsitoTutte}
              defaultOpen={confermaTutteAperto}
            />
          ) : null}
          {tappa.modificabile ? (
            <AggiungiGiocatoreDialog
              tappaId={tappa.id}
              tabelloni={tappa.tabelloni}
              cerca={cerca}
              action={aggiungi}
              defaultOpen={aggiungiAperto}
              initialQuery={queryIniziale}
              initialRicerca={ricercaIniziale}
              // One primary action: confirming, while anyone is pending.
              triggerVariant={inAttesa > 0 ? "secondary" : "primary"}
            />
          ) : null}
          <EsportaCsv tappa={tappa} />
        </div>
        <p
          id={ESITO_TUTTE_ID}
          tabIndex={-1}
          data-testid="iscritti-esito-tutte"
          className="self-start font-medium focus-ring empty:hidden"
        >
          {esitoTutte}
        </p>
      </section>

      {tappa.tabelloni.map((tabellone) => (
        <Tabellone
          key={tabellone.categoria}
          tabellone={tabellone}
          modificabile={tappa.modificabile}
          esito={esiti[tabellone.categoria]}
          onRimuovi={onRimuovi}
          onConferma={onConferma}
          inConferma={inConferma?.id ?? null}
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
