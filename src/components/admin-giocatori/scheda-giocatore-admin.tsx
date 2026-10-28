import { ArrowLeftIcon } from "lucide-react";
import Link from "next/link";
import { StatoTappaBadge } from "@/components/admin/stato-tappa-badge";
import {
  ResponsiveTable,
  type ResponsiveTableColumn,
} from "@/components/responsive-table/responsive-table";
import { dataTappaLabel } from "@/lib/classifica-generale/giocatore";
import { STATO_ISCRIZIONE_LABEL } from "@/lib/iscrizioni/admin/format";
import { GIOCATORI_ADMIN_PATH } from "@/lib/giocatori/admin/paths";
import type {
  CambioCategoriaAction,
  CambioCategoriaState,
  IscrizioneGiocatore,
  PuntiStagione,
  SchedaGiocatoreAdmin as Scheda,
} from "@/lib/giocatori/admin/types";
import { CATEGORIA_LABEL } from "@/lib/tappe/dettaglio";
import type { Categoria } from "@/lib/db/types";
import { CambiaCategoria } from "./cambia-categoria";
import { CategoriaGiocatore, StatoVerifica } from "./parti";
import { VerificaCategoria } from "./verifica-categoria";

const COLONNE_ISCRIZIONI: readonly ResponsiveTableColumn<IscrizioneGiocatore>[] =
  [
    { key: "tappa", header: "Tappa", rowHeader: true, width: "28%" },
    {
      key: "data",
      header: "Data",
      width: "16%",
      render: (i) => (
        <time dateTime={i.data} className="font-mono tabular-nums">
          {dataTappaLabel(i.data)}
        </time>
      ),
    },
    {
      key: "statoTappa",
      header: "Stato della tappa",
      width: "18%",
      render: (i) => <StatoTappaBadge stato={i.statoTappa} />,
    },
    {
      key: "categoria",
      header: "Tabellone",
      width: "14%",
      render: (i) => CATEGORIA_LABEL[i.categoria],
    },
    {
      key: "posto",
      header: "Posto",
      numeric: true,
      width: "10%",
      render: (i) => (i.posto === null ? "–" : String(i.posto)),
    },
    {
      key: "stato",
      header: "Iscrizione",
      width: "14%",
      render: (i) => STATO_ISCRIZIONE_LABEL[i.stato],
    },
  ];

const COLONNE_PUNTI: readonly ResponsiveTableColumn<PuntiStagione>[] = [
  {
    key: "stagione",
    header: "Stagione",
    rowHeader: true,
    render: (p) => <span className="font-mono">{p.stagione}</span>,
  },
  {
    key: "categoria",
    header: "Classifica",
    render: (p) => CATEGORIA_LABEL[p.categoria],
  },
  {
    key: "posizione",
    header: "Posizione",
    numeric: true,
    render: (p) => (p.posizione === null ? "–" : `${p.posizione}º`),
  },
  {
    key: "punti",
    header: "Punti",
    numeric: true,
    render: (p) => `${p.punti}${p.provvisori ? " (provvisori)" : ""}`,
  },
  { key: "tappe", header: "Tappe giocate", numeric: true },
];

function Sezione({
  id,
  titolo,
  children,
}: {
  id: string;
  titolo: string;
  children: React.ReactNode;
}) {
  return (
    <section aria-labelledby={id} className="flex min-w-0 flex-col gap-stack">
      <h2 id={id} className="font-heading text-2xl font-semibold">
        {titolo}
      </h2>
      {children}
    </section>
  );
}

/**
 * w-admin-giocatore: profile data, registrations, overall points per
 * season, the category check and the category change (BLVS-54).
 */
export function SchedaGiocatoreAdmin({
  scheda,
  cambia,
  verifica,
  initialState,
  initialAperto,
}: {
  scheda: Scheda;
  /** The `cambiaCategoria` server action (a fake in Storybook). */
  cambia: CambioCategoriaAction;
  /** The `verificaCategoria` server action. */
  verifica: CambioCategoriaAction;
  initialState?: CambioCategoriaState;
  initialAperto?: Categoria | null;
}) {
  const { giocatore } = scheda;
  const nome = `${giocatore.nome} ${giocatore.cognome}`.trim() || "Senza nome";
  return (
    <div
      className="flex flex-col gap-stack-lg"
      data-testid="scheda-giocatore-admin"
    >
      <Link
        href={GIOCATORI_ADMIN_PATH}
        className="inline-flex w-fit items-center gap-space-2 underline underline-offset-4 focus-ring"
      >
        <ArrowLeftIcon aria-hidden className="size-4" />
        Tutti i giocatori
      </Link>

      <Sezione id="scheda-dati" titolo="Dati">
        <dl className="grid grid-cols-1 gap-space-4 sm:grid-cols-[repeat(auto-fit,minmax(min(100%,12rem),1fr))]">
          <div className="flex min-w-0 flex-col gap-space-1">
            <dt className="text-sm font-medium">Nome</dt>
            <dd className="break-words">{nome}</dd>
          </div>
          <div className="flex min-w-0 flex-col gap-space-1">
            <dt className="text-sm font-medium">Email</dt>
            <dd className="font-mono text-sm break-all">
              {giocatore.email || "–"}
            </dd>
          </div>
          <div className="flex min-w-0 flex-col gap-space-1">
            <dt className="text-sm font-medium">Categoria</dt>
            <dd data-testid="scheda-categoria">
              <CategoriaGiocatore categoria={giocatore.categoria} />
            </dd>
          </div>
          <div className="flex min-w-0 flex-col items-start gap-space-1">
            <dt className="text-sm font-medium">Verifica della categoria</dt>
            <dd>
              <StatoVerifica
                daVerificare={giocatore.daVerificare}
                ruolo={giocatore.ruolo}
              />
            </dd>
          </div>
        </dl>
      </Sezione>

      <Sezione id="scheda-categoria-titolo" titolo="Categoria">
        <p className="max-w-prose">
          Il cambio sposta le iscrizioni alle tappe non ancora iniziate nel
          tabellone dell&apos;altra categoria e porta i punti nella sua
          classifica generale. Prima di confermare ne vedi gli effetti.
        </p>
        {giocatore.categoria && giocatore.ruolo === "giocatore" ? (
          <VerificaCategoria
            utenteId={giocatore.id}
            daVerificare={giocatore.daVerificare}
            action={verifica}
          />
        ) : null}
        <CambiaCategoria
          utenteId={giocatore.id}
          nome={nome}
          cambi={scheda.cambi}
          action={cambia}
          initialState={initialState}
          initialAperto={initialAperto}
        />
      </Sezione>

      <Sezione id="scheda-iscrizioni" titolo="Iscrizioni">
        <ResponsiveTable
          caption="Iscrizioni del giocatore"
          captionHidden
          columns={COLONNE_ISCRIZIONI}
          rows={scheda.iscrizioni}
          getRowKey={(i) => i.id}
          rowAttributes={(i) => ({
            "data-tappa": i.tappaId,
            "data-categoria": i.categoria,
          })}
          emptyMessage="Nessuna iscrizione."
          stackBelow="lg"
        />
      </Sezione>

      <Sezione id="scheda-punti" titolo="Classifica generale">
        <ResponsiveTable
          caption="Punti per stagione"
          captionHidden
          columns={COLONNE_PUNTI}
          rows={scheda.punti}
          getRowKey={(p) => String(p.stagione)}
          emptyMessage="Nessun punto in classifica generale."
        />
      </Sezione>
    </div>
  );
}
