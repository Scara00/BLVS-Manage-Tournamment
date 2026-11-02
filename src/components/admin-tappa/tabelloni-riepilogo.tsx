import {
  ResponsiveTable,
  type ResponsiveTableColumn,
} from "@/components/responsive-table/responsive-table";
import Link from "next/link";
import { FaseConclusaBadge } from "@/components/admin-chiusura/fase-conclusa-badge";
import { gironiEditorPath } from "@/lib/gironi/editor/types";
import type { TabelloneView } from "@/lib/tappe/gestione-format";

const columns: ResponsiveTableColumn<TabelloneView>[] = [
  {
    key: "categoriaLabel",
    header: "Tabellone",
    rowHeader: true,
    width: "25%",
    // Mixed board: the confirmed players of each half under the name.
    render: (row) =>
      row.quote ? (
        <span className="flex flex-col">
          <span>{row.categoriaLabel}</span>
          <span className="text-sm font-normal text-muted-foreground">
            {row.quote}
          </span>
        </span>
      ) : (
        row.categoriaLabel
      ),
  },
  {
    key: "iscritti",
    header: "Iscritti confermati",
    numeric: true,
    width: "20%",
  },
  { key: "inAttesa", header: "In attesa", numeric: true, width: "20%" },
  {
    key: "fase",
    header: "Fase",
    // BLVS-43: a concluded board reads «Conclusa», as text on the badge.
    render: (row) => (row.concluso ? <FaseConclusaBadge /> : row.fase),
  },
];

/** «Gironi» column: the groups editor of the board (BLVS-28). */
function colonnaGironi(tappaId: string): ResponsiveTableColumn<TabelloneView> {
  return {
    key: "gironi",
    header: "Gironi",
    render: (row) => (
      <Link
        href={gironiEditorPath(tappaId, row.categoria)}
        className="font-heading font-semibold underline decoration-2 underline-offset-4 focus-ring"
      >
        Modifica gironi
        <span className="sr-only"> del tabellone {row.categoriaLabel}</span>
      </Link>
    ),
  };
}

/** Per board (M/F, or the mixed one): registrations and phase. */
export function TabelloniRiepilogo({
  tappaId,
  tabelloni,
}: {
  /** Adds the «Gironi» column with the link to the groups editor. */
  tappaId?: string;
  tabelloni: readonly TabelloneView[];
}) {
  return (
    <ResponsiveTable
      caption="Tabelloni"
      columns={tappaId ? [...columns, colonnaGironi(tappaId)] : columns}
      rows={tabelloni}
      getRowKey={(row) => row.categoria}
      emptyMessage="Questa tappa non ha tabelloni."
    />
  );
}
