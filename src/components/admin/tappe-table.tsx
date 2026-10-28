import { FaseConclusaBadge } from "@/components/admin-chiusura/fase-conclusa-badge";
import Link from "next/link";
import {
  ResponsiveTable,
  type ResponsiveTableColumn,
} from "@/components/responsive-table/responsive-table";
import { PhaseBadge } from "@/components/scoreboard";
import {
  contaPosti,
  descriviPosti,
  isAnnullabile,
  isArchiviabile,
  iscrittiDaAvvisare,
  type AdminCategoria,
  type AdminTappa,
} from "@/lib/admin/tappe";
import type { StatoTappa } from "@/lib/db/types";
import { gestioneTappaPath } from "@/lib/tappe/gestione-state";
import type {
  AnnullaTappaAction,
  ArchiviaTappaAction,
} from "@/lib/tappe/annullamento/state";
import type { EliminaTappaAction } from "@/lib/tappe/eliminazione/state";
import { cn } from "@/lib/utils";
import { AnnullaTappa } from "./annulla-tappa";
import { ArchiviaTappa } from "./archivia-tappa";
import { EliminaTappa } from "./elimina-tappa";
import { StatoTappaBadge } from "./stato-tappa-badge";

/** Server actions of BLVS-22, passed down by the page (fakes in stories). */
export type AzioniTappe = {
  annulla: AnnullaTappaAction;
  archivia: ArchiviaTappaAction;
  /** Deletes the stage, in any state. */
  elimina: EliminaTappaAction;
  /** Where «Accedi di nuovo» returns to after an expired session. */
  returnPath?: string;
};

const categoriaLabel = { M: "Maschile", F: "Femminile" } as const;

/** Started or over: points in the overall standing (`tappa_in_classifica`). */
const STATI_CON_RISULTATI: readonly StatoTappa[] = [
  "in_corso",
  "conclusa",
  "archiviata",
];

function CategoriaCell({ categoria }: { categoria: AdminCategoria }) {
  const posti = contaPosti(categoria);
  return (
    <div
      data-slot="categoria-cell"
      data-categoria={categoria.categoria}
      // `anywhere` (not `break-word`) lowers the min-content width, so at 200 %
      // text «Completo» or «◆ SILVER» wrap inside a fifth of the table.
      className="flex min-w-0 flex-col items-start gap-space-1 [overflow-wrap:anywhere]"
    >
      {categoria.fase ? (
        <PhaseBadge phase={categoria.fase} className="max-w-full flex-wrap" />
      ) : (
        <span className="text-sm text-muted-foreground">Fase da definire</span>
      )}
      {/* BLVS-43: results closed, said as text. */}
      {categoria.concluso ? (
        <FaseConclusaBadge className="max-w-full flex-wrap" />
      ) : null}
      <span className="font-mono text-lg font-semibold tabular-nums">
        <span aria-hidden="true">
          {posti.iscritti}/{posti.posti}
        </span>
        <span className="sr-only">
          {posti.iscritti} iscritti su {posti.posti} posti
        </span>
      </span>
      <span
        className={cn(
          "text-sm",
          posti.completo ? "font-semibold" : "text-muted-foreground",
        )}
      >
        {descriviPosti(posti)}
      </span>
    </div>
  );
}

function categoriaColumn(
  index: 0 | 1,
  key: "M" | "F",
  width: string,
): ResponsiveTableColumn<AdminTappa> {
  return {
    key,
    header: categoriaLabel[key],
    width,
    render: (row) => <CategoriaCell categoria={row.categorie[index]} />,
  };
}

function StatoCell({ tappa }: { tappa: AdminTappa }) {
  return (
    <div className="flex min-w-0 flex-col items-start gap-space-1 [overflow-wrap:anywhere]">
      <StatoTappaBadge stato={tappa.stato} />
      {tappa.motivoAnnullamento ? (
        <p className="text-sm">
          <span className="font-semibold">Motivo:</span>{" "}
          {tappa.motivoAnnullamento}
        </p>
      ) : null}
    </div>
  );
}

/**
 * Cancel and archive (BLVS-22), then delete, offered in every state. An
 * archived stage is otherwise read only.
 */
function AzioniCell({
  tappa,
  azioni,
}: {
  tappa: AdminTappa;
  azioni: AzioniTappe;
}) {
  return (
    <div
      data-slot="azioni-tappa"
      className="flex min-w-0 flex-col items-start gap-space-2 [overflow-wrap:anywhere]"
    >
      <AnnullaTappa
        tappaId={tappa.id}
        nome={tappa.nome}
        iscritti={iscrittiDaAvvisare(tappa)}
        annullabile={isAnnullabile(tappa)}
        action={azioni.annulla}
        returnPath={azioni.returnPath}
      />
      <ArchiviaTappa
        tappaId={tappa.id}
        nome={tappa.nome}
        archiviabile={isArchiviabile(tappa)}
        archiviata={tappa.stato === "archiviata"}
        action={azioni.archivia}
      />
      {tappa.stato === "archiviata" ? (
        <p className="text-sm text-muted-foreground">
          Consultabile, non modificabile.
        </p>
      ) : null}
      <EliminaTappa
        tappaId={tappa.id}
        nome={tappa.nome}
        iscritti={iscrittiDaAvvisare(tappa)}
        conRisultati={STATI_CON_RISULTATI.includes(tappa.stato)}
        action={azioni.elimina}
        returnPath={azioni.returnPath}
      />
    </div>
  );
}

function tableColumns(
  azioni: AzioniTappe | undefined,
): ResponsiveTableColumn<AdminTappa>[] {
  const base: ResponsiveTableColumn<AdminTappa>[] = [
    {
      key: "nome",
      header: "Tappa",
      rowHeader: true,
      width: azioni ? "20%" : "26%",
      render: (row) => (
        <Link
          href={gestioneTappaPath(row.id)}
          className="font-semibold underline decoration-2 underline-offset-4 focus-ring"
        >
          {row.nome}
          <span className="sr-only">: gestisci la tappa</span>
        </Link>
      ),
    },
    { key: "periodo", header: "Data", width: azioni ? "13%" : "16%" },
    {
      key: "stato",
      header: "Iscrizioni",
      width: azioni ? "17%" : "18%",
      render: (row) => <StatoCell tappa={row} />,
    },
    categoriaColumn(0, "M", azioni ? "16%" : "20%"),
    categoriaColumn(1, "F", azioni ? "16%" : "20%"),
  ];
  if (!azioni) return base;
  return [
    ...base,
    {
      key: "azioni",
      header: "Azioni",
      render: (row) => <AzioniCell tappa={row} azioni={azioni} />,
    },
  ];
}

/**
 * Admin calendar: name, dates, registration status, then per category the
 * Gold/Silver phase (★/◆) and registered players against seats.
 */
export function TappeTable({
  tappe,
  caption = "Tappe del circuito",
  emptyMessage = "Nessuna tappa in calendario. Le tappe create, anche in bozza, compariranno qui.",
  azioni,
}: {
  tappe: readonly AdminTappa[];
  caption?: string;
  emptyMessage?: string;
  /** Adds the «Azioni» column (cancel, archive). */
  azioni?: AzioniTappe;
}) {
  return (
    <ResponsiveTable
      caption={caption}
      columns={tableColumns(azioni)}
      rows={tappe}
      getRowKey={(row) => row.id}
      emptyMessage={emptyMessage}
      rowAttributes={(row) => ({ "data-stato": row.stato })}
    />
  );
}
