import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import {
  GestioneTappaLoading,
  StatoTappaBadge,
} from "@/components/admin-tappa";
import { PageContainer } from "@/components/layout/page-container";
import {
  ResponsiveTable,
  type ResponsiveTableColumn,
} from "@/components/responsive-table/responsive-table";
import type { TappaAdminItem } from "@/lib/tappe/gestione-format";
import { gestioneTappaPath } from "@/lib/tappe/gestione-state";
import { readTappeAdmin } from "@/lib/tappe/gestione";

export const metadata: Metadata = { title: "Tappe · Amministrazione" };

const columns: ResponsiveTableColumn<TappaAdminItem>[] = [
  {
    key: "nome",
    header: "Tappa",
    rowHeader: true,
    width: "30%",
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
  { key: "periodo", header: "Date", width: "20%" },
  {
    key: "stato",
    header: "Stato",
    width: "20%",
    render: (row) => <StatoTappaBadge stato={row.stato} />,
  },
  { key: "scadenza", header: "Iscrizioni" },
];

async function TappeContent() {
  const tappe = await readTappeAdmin();
  return (
    <ResponsiveTable
      caption="Tappe del circuito"
      columns={columns}
      rows={tappe}
      getRowKey={(row) => row.id}
      emptyMessage="Nessuna tappa in calendario."
    />
  );
}

export default function AdminTappePage() {
  return (
    <PageContainer
      title="Tappe"
      eyebrow="Amministrazione"
      description="Scegli una tappa per gestirne lo stato e le iscrizioni."
    >
      <Suspense
        fallback={<GestioneTappaLoading testo="Caricamento delle tappe…" />}
      >
        <TappeContent />
      </Suspense>
    </PageContainer>
  );
}
