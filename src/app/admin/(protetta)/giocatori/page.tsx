import type { Metadata } from "next";
import { PageContainer } from "@/components/layout/page-container";

export const metadata: Metadata = { title: "Giocatori · Amministrazione" };

export default function AdminGiocatoriPage() {
  return (
    <PageContainer
      title="Giocatori"
      eyebrow="Amministrazione"
      description="Consulta e aggiorna l'anagrafica dei giocatori."
    >
      <p className="border border-dashed border-input p-inset-lg text-muted-foreground">
        Questa sezione arriverà in una prossima versione.
      </p>
    </PageContainer>
  );
}
