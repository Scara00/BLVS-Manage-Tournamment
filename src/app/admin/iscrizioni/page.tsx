import type { Metadata } from "next";
import { PageContainer } from "@/components/layout/page-container";

export const metadata: Metadata = { title: "Iscrizioni · Amministrazione" };

export default function AdminIscrizioniPage() {
  return (
    <PageContainer
      title="Iscrizioni"
      eyebrow="Amministrazione"
      description="Approva o rifiuta le iscrizioni delle coppie."
    >
      <p className="border border-dashed border-input p-inset-lg text-muted-foreground">
        Questa sezione arriverà in una prossima versione.
      </p>
    </PageContainer>
  );
}
