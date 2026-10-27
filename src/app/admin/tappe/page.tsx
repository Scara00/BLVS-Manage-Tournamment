import type { Metadata } from "next";
import { PageContainer } from "@/components/layout/page-container";

export const metadata: Metadata = { title: "Tappe · Amministrazione" };

export default function AdminTappePage() {
  return (
    <PageContainer
      title="Tappe"
      eyebrow="Amministrazione"
      description="Crea e modifica le tappe del circuito."
    >
      <p className="border border-dashed border-input p-inset-lg text-muted-foreground">
        Questa sezione arriverà in una prossima versione.
      </p>
    </PageContainer>
  );
}
