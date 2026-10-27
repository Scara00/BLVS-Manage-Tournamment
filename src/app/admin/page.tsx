import type { Metadata } from "next";
import { Suspense } from "react";
import { PageContainer } from "@/components/layout/page-container";
import {
  ResponsiveTable,
  type ResponsiveTableColumn,
} from "@/components/responsive-table/responsive-table";
import { readAdminDashboard } from "@/lib/admin/dashboard";
import type { IscrizioneInAttesa } from "@/lib/admin/dashboard-format";

export const metadata: Metadata = { title: "Dashboard amministrazione" };

const columns: ResponsiveTableColumn<IscrizioneInAttesa>[] = [
  { key: "player", header: "Giocatore", rowHeader: true },
  { key: "stage", header: "Tappa" },
  { key: "received", header: "Ricevuta il", width: "25%" },
];

async function DashboardContent() {
  const dashboard = await readAdminDashboard();
  const stats = [
    { label: "Tappe in calendario", value: dashboard.tappe },
    { label: "Iscrizioni da approvare", value: dashboard.iscrizioniInAttesa },
    { label: "Giocatori registrati", value: dashboard.giocatori },
  ];

  return (
    <>
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
        rows={dashboard.ultimeIscrizioni}
        getRowKey={(row) => row.id}
        emptyMessage="Nessuna iscrizione in attesa."
      />
    </>
  );
}

export default function AdminDashboardPage() {
  return (
    <PageContainer
      title="Dashboard"
      eyebrow="Amministrazione"
      description="Riepilogo del circuito e delle attività in attesa."
    >
      <Suspense
        fallback={
          <p className="text-muted-foreground" aria-busy="true">
            Caricamento del riepilogo…
          </p>
        }
      >
        <DashboardContent />
      </Suspense>
    </PageContainer>
  );
}
