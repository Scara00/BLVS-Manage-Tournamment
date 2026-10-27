import {
  ResponsiveTable,
  type ResponsiveTableColumn,
} from "@/components/responsive-table/responsive-table";
import type { TabelloneView } from "@/lib/tappe/gestione-format";

const columns: ResponsiveTableColumn<TabelloneView>[] = [
  { key: "categoriaLabel", header: "Tabellone", rowHeader: true, width: "25%" },
  {
    key: "iscritti",
    header: "Iscritti confermati",
    numeric: true,
    width: "20%",
  },
  { key: "inAttesa", header: "In attesa", numeric: true, width: "20%" },
  { key: "fase", header: "Fase" },
];

/** Per board (M/F): confirmed and pending registrations, and its phase. */
export function TabelloniRiepilogo({
  tabelloni,
}: {
  tabelloni: readonly TabelloneView[];
}) {
  return (
    <ResponsiveTable
      caption="Tabelloni"
      columns={columns}
      rows={tabelloni}
      getRowKey={(row) => row.categoria}
      emptyMessage="Questa tappa non ha tabelloni."
    />
  );
}
