import type { Metadata } from "next";
import { Suspense } from "react";
import {
  AdminTappeLoading,
  AdminTappeSection,
  PendingScoresBanner,
} from "@/components/admin";
import { PageContainer } from "@/components/layout/page-container";
import {
  LiveAnnouncer,
  LiveBarConnected,
  LiveProvider,
} from "@/components/live";
import {
  ResponsiveTable,
  type ResponsiveTableColumn,
} from "@/components/responsive-table/responsive-table";
import { readAdminDashboard } from "@/lib/admin/dashboard";
import type { IscrizioneInAttesa } from "@/lib/admin/dashboard-format";
import { parseFiltroStato, partiteDaInserireOggi } from "@/lib/admin/tappe";
import { readAdminTappe } from "@/lib/admin/tappe-read";
import { readLiveSync } from "@/lib/live/read";

export const metadata: Metadata = { title: "Dashboard amministrazione" };

const columns: ResponsiveTableColumn<IscrizioneInAttesa>[] = [
  { key: "player", header: "Giocatore", rowHeader: true },
  { key: "stage", header: "Tappa" },
  { key: "received", header: "Ricevuta il", width: "25%" },
];

/** Race day only: «N partite da inserire», kept current over SSE. */
async function RaceDayBanner() {
  const [tappe, initial] = await Promise.all([
    readAdminTappe(),
    readLiveSync(),
  ]);
  const stages = partiteDaInserireOggi(tappe);
  if (stages.length === 0) return null;
  return (
    <LiveProvider initial={initial}>
      <div className="flex flex-col gap-stack-sm">
        <PendingScoresBanner initial={stages} />
        <LiveBarConnected />
        <LiveAnnouncer types={["pending-scores"]} />
      </div>
    </LiveProvider>
  );
}

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

async function TappeContent({
  searchParams,
}: {
  searchParams: PageProps<"/admin">["searchParams"];
}) {
  const [tappe, params] = await Promise.all([readAdminTappe(), searchParams]);
  return (
    <AdminTappeSection
      tappe={tappe}
      filtro={parseFiltroStato(params.stato)}
      basePath="/admin"
    />
  );
}

export default function AdminDashboardPage({
  searchParams,
}: PageProps<"/admin">) {
  return (
    <PageContainer
      title="Dashboard"
      eyebrow="Amministrazione"
      description="Riepilogo del circuito e delle attività in attesa."
    >
      <Suspense fallback={null}>
        <RaceDayBanner />
      </Suspense>
      <Suspense
        fallback={
          <p className="text-muted-foreground" aria-busy="true">
            Caricamento del riepilogo…
          </p>
        }
      >
        <DashboardContent />
      </Suspense>
      <Suspense fallback={<AdminTappeLoading />}>
        <TappeContent searchParams={searchParams} />
      </Suspense>
    </PageContainer>
  );
}
