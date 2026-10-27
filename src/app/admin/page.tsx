import type { Metadata } from "next";
import { PageContainer } from "@/components/layout/page-container";
import {
  ResponsiveTable,
  type ResponsiveTableColumn,
} from "@/components/responsive-table/responsive-table";
import {
  demoRegistrations,
  demoStages,
  type DemoRegistration,
} from "@/lib/demo/tournament";

export const metadata: Metadata = { title: "Dashboard amministrazione" };

const stats = [
  { label: "Tappe in calendario", value: demoStages.length },
  { label: "Iscrizioni da approvare", value: demoRegistrations.length },
  { label: "Coppie in classifica", value: 48 },
];

const columns: ResponsiveTableColumn<DemoRegistration>[] = [
  { key: "pair", header: "Coppia", rowHeader: true },
  { key: "stage", header: "Tappa" },
  { key: "received", header: "Ricevuta il", width: "25%" },
];

export default function AdminDashboardPage() {
  return (
    <PageContainer
      title="Dashboard"
      eyebrow="Amministrazione"
      description="Riepilogo del circuito e delle attività in attesa."
    >
      <dl className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,14rem),1fr))] gap-stack">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="flex flex-col-reverse gap-space-2 border border-border p-inset-lg"
          >
            <dt className="text-muted-foreground">{stat.label}</dt>
            <dd className="font-mono text-4xl font-semibold">{stat.value}</dd>
          </div>
        ))}
      </dl>
      <ResponsiveTable
        caption="Ultime iscrizioni ricevute"
        columns={columns}
        rows={demoRegistrations}
        getRowKey={(row) => row.id}
      />
    </PageContainer>
  );
}
