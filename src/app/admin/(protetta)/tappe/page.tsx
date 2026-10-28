import type { Metadata } from "next";
import { Suspense } from "react";
import { AdminTappeLoading, AdminTappeSection } from "@/components/admin";
import { PageContainer } from "@/components/layout/page-container";
import { parseFiltroStato } from "@/lib/admin/tappe";
import { readAdminTappe } from "@/lib/admin/tappe-read";
import { annullaTappa, archiviaTappa } from "@/lib/tappe/annullamento/actions";
import { eliminaTappa } from "@/lib/tappe/eliminazione/actions";

export const metadata: Metadata = { title: "Tappe · Amministrazione" };

async function TappeContent({
  searchParams,
}: {
  searchParams: PageProps<"/admin/tappe">["searchParams"];
}) {
  const [tappe, params] = await Promise.all([readAdminTappe(), searchParams]);
  return (
    <AdminTappeSection
      tappe={tappe}
      filtro={parseFiltroStato(params.stato)}
      basePath="/admin/tappe"
      azioni={{
        annulla: annullaTappa,
        archivia: archiviaTappa,
        elimina: eliminaTappa,
      }}
    />
  );
}

export default function AdminTappePage({
  searchParams,
}: PageProps<"/admin/tappe">) {
  return (
    <PageContainer
      title="Tappe"
      eyebrow="Amministrazione"
      description="Tutte le tappe del circuito, bozze comprese, con iscritti e posti per categoria."
    >
      <Suspense fallback={<AdminTappeLoading />}>
        <TappeContent searchParams={searchParams} />
      </Suspense>
    </PageContainer>
  );
}
