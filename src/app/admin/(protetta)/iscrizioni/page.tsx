import type { Metadata } from "next";
import { Suspense } from "react";
import { SceltaTappaIscritti } from "@/components/admin-iscritti";
import { GestioneTappaLoading } from "@/components/admin-tappa";
import { PageContainer } from "@/components/layout/page-container";
import { readTappeAdmin } from "@/lib/tappe/gestione";

export const metadata: Metadata = { title: "Iscrizioni · Amministrazione" };

async function SceltaContent() {
  return <SceltaTappaIscritti tappe={await readTappeAdmin()} />;
}

export default function AdminIscrizioniPage() {
  return (
    <PageContainer
      title="Iscrizioni"
      eyebrow="Amministrazione"
      description="Scegli una tappa per vedere, aggiungere e rimuovere gli iscritti di ogni tabellone ed esportarli in CSV."
    >
      <Suspense
        fallback={<GestioneTappaLoading testo="Caricamento delle tappe…" />}
      >
        <SceltaContent />
      </Suspense>
    </PageContainer>
  );
}
