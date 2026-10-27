import Link from "next/link";
import {
  ResponsiveTable,
  type ResponsiveTableColumn,
} from "@/components/responsive-table/responsive-table";
import { PhaseBadge } from "@/components/scoreboard";
import {
  contaPosti,
  descriviPosti,
  type AdminCategoria,
  type AdminTappa,
} from "@/lib/admin/tappe";
import { gestioneTappaPath } from "@/lib/tappe/gestione-state";
import { cn } from "@/lib/utils";
import { StatoTappaBadge } from "./stato-tappa-badge";

const categoriaLabel = { M: "Maschile", F: "Femminile" } as const;

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
): ResponsiveTableColumn<AdminTappa> {
  return {
    key,
    header: categoriaLabel[key],
    width: "20%",
    render: (row) => <CategoriaCell categoria={row.categorie[index]} />,
  };
}

const columns: ResponsiveTableColumn<AdminTappa>[] = [
  {
    key: "nome",
    header: "Tappa",
    rowHeader: true,
    width: "26%",
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
  { key: "periodo", header: "Data", width: "16%" },
  {
    key: "stato",
    header: "Iscrizioni",
    width: "18%",
    render: (row) => <StatoTappaBadge stato={row.stato} />,
  },
  categoriaColumn(0, "M"),
  categoriaColumn(1, "F"),
];

/**
 * Admin calendar: name, dates, registration status, then per category the
 * Gold/Silver phase (★/◆) and registered players against seats.
 */
export function TappeTable({
  tappe,
  caption = "Tappe del circuito",
  emptyMessage = "Nessuna tappa in calendario. Le tappe create, anche in bozza, compariranno qui.",
}: {
  tappe: readonly AdminTappa[];
  caption?: string;
  emptyMessage?: string;
}) {
  return (
    <ResponsiveTable
      caption={caption}
      columns={columns}
      rows={tappe}
      getRowKey={(row) => row.id}
      emptyMessage={emptyMessage}
      rowAttributes={(row) => ({ "data-stato": row.stato })}
    />
  );
}
