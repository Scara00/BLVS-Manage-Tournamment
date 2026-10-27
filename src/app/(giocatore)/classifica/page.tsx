import type { Metadata } from "next";
import { PageContainer } from "@/components/layout/page-container";
import {
  ResponsiveTable,
  type ResponsiveTableColumn,
} from "@/components/responsive-table/responsive-table";
import { demoStandings, type DemoStanding } from "@/lib/demo/tournament";

export const metadata: Metadata = { title: "Classifica" };

const columns: ResponsiveTableColumn<DemoStanding>[] = [
  {
    key: "position",
    header: "Posizione",
    numeric: true,
    align: "start",
    width: "18%",
  },
  { key: "pair", header: "Coppia", rowHeader: true },
  { key: "stages", header: "Tappe giocate", numeric: true, width: "20%" },
  { key: "points", header: "Punti", numeric: true, width: "16%" },
];

export default function ClassificaPage() {
  return (
    <PageContainer
      title="Classifica"
      eyebrow="Circuito 2026"
      description="La classifica generale del circuito, aggiornata dopo ogni tappa."
    >
      <ResponsiveTable
        caption="Classifica generale maschile"
        columns={columns}
        rows={demoStandings}
        getRowKey={(row) => row.pair}
        cardBadgeKey="position"
      />
    </PageContainer>
  );
}
