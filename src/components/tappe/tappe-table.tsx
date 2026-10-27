import Link from "next/link";
import type { ReactNode } from "react";
import {
  ResponsiveTable,
  type ResponsiveTableColumn,
} from "@/components/responsive-table/responsive-table";
import { buttonVariants } from "@/components/ui/button";
import { loginHref } from "@/lib/navigation/auth-paths";
import { PROFILO_MODIFICA_PATH } from "@/lib/profilo/types";
import {
  descriviPosti,
  FASE_LABEL,
  type TappaGiocatore,
} from "@/lib/tappe/format";
import { TAPPE_PATH, tappaHref } from "@/lib/tappe/paths";
import { StatoTappaBadge } from "./stato-tappa-badge";

/** A dash for sighted users, words for screen readers. */
function Vuoto({ label }: { label: string }) {
  return (
    <>
      <span aria-hidden="true">—</span>
      <span className="sr-only">{label}</span>
    </>
  );
}

const textLink =
  "font-medium text-primary underline decoration-2 underline-offset-4 hover:decoration-4 focus-ring";

function PostiCell({
  tappa,
  connesso,
}: {
  tappa: TappaGiocatore;
  connesso: boolean;
}) {
  if (tappa.posti) {
    return (
      <span className="font-mono font-semibold tabular-nums">
        {descriviPosti(tappa.posti)}
      </span>
    );
  }
  if (tappa.stato === "annullata") return <Vuoto label="Nessun posto" />;
  if (!connesso) {
    return (
      <Link href={loginHref(TAPPE_PATH)} className={textLink}>
        Accedi per vedere i posti
      </Link>
    );
  }
  return (
    <Link href={PROFILO_MODIFICA_PATH} className={textLink}>
      Indica la categoria per vedere i posti
    </Link>
  );
}

function IscrizioneCell({ tappa }: { tappa: TappaGiocatore }) {
  if (tappa.iscrivibile) {
    return (
      <Link
        href={tappaHref(tappa.id)}
        aria-label={`Iscriviti a ${tappa.name}`}
        className={buttonVariants({ size: "sm", className: "max-w-full" })}
      >
        Iscriviti
      </Link>
    );
  }
  let motivo: ReactNode = <Vuoto label="Non disponibile" />;
  if (tappa.stato === "annullata") motivo = "Annullata";
  else if (tappa.stato === "iscrizioni_aperte" && tappa.posti?.liberi === 0)
    motivo = "Completo";
  else if (tappa.stato === "iscrizioni_chiuse") motivo = "Chiuse";
  return <span className="[overflow-wrap:anywhere]">{motivo}</span>;
}

function columns(connesso: boolean): ResponsiveTableColumn<TappaGiocatore>[] {
  return [
    { key: "name", header: "Tappa", rowHeader: true, width: "18%" },
    {
      key: "date",
      header: "Data",
      width: "11%",
      render: (t) => <span className="font-mono tabular-nums">{t.date}</span>,
    },
    { key: "place", header: "Luogo", width: "16%" },
    {
      key: "scadenza",
      header: "Scadenza iscrizioni",
      width: "13%",
      render: (t) =>
        t.scadenza && t.scadenzaIso ? (
          <time dateTime={t.scadenzaIso} className="font-mono tabular-nums">
            {t.scadenza}
          </time>
        ) : (
          <Vuoto label="Nessuna scadenza" />
        ),
    },
    {
      key: "posti",
      header: "Posti",
      width: "12%",
      render: (t) => <PostiCell tappa={t} connesso={connesso} />,
    },
    {
      key: "stato",
      header: "Stato",
      width: "11%",
      render: (t) => <StatoTappaBadge stato={t.stato} />,
    },
    {
      key: "fase",
      header: "Fase",
      width: "9%",
      render: (t) =>
        t.fase ? FASE_LABEL[t.fase] : <Vuoto label="Nessuna fase" />,
    },
    {
      key: "iscrizione",
      header: "Iscrizione",
      width: "10%",
      render: (t) => <IscrizioneCell tappa={t} />,
    },
  ];
}

/**
 * The player stage list: a table with column headers on desktop, one card
 * per stage below `md` (390 px phones).
 */
export function TappeTable({
  tappe,
  connesso,
}: {
  tappe: readonly TappaGiocatore[];
  connesso: boolean;
}) {
  return (
    <ResponsiveTable
      caption="Calendario delle tappe"
      captionHidden
      columns={columns(connesso)}
      rows={tappe}
      getRowKey={(t) => t.id}
      emptyMessage="Nessuna tappa in calendario per ora."
      rowAttributes={(t) => ({ "data-tappa": t.id, "data-stato": t.stato })}
    />
  );
}
