import type { Metadata } from "next";
import { Suspense } from "react";
import { PageContainer } from "@/components/layout/page-container";
import {
  MieIscrizioni,
  MieIscrizioniLoading,
  MieIscrizioniSessioneScaduta,
} from "@/components/mie-iscrizioni";
import { annullaIscrizione } from "@/lib/iscrizioni/annullamento/actions";
import { readMieIscrizioni } from "@/lib/iscrizioni/mie/read";

export const metadata: Metadata = { title: "Le mie iscrizioni" };

async function MieIscrizioniContent() {
  const vista = await readMieIscrizioni();
  if (!vista) return <MieIscrizioniSessioneScaduta />;
  return <MieIscrizioni vista={vista} action={annullaIscrizione} />;
}

/** w-mie-iscrizioni (BLVS-51): registrations, season summary and cancel. */
export default function MieIscrizioniPage() {
  return (
    <PageContainer
      title="Le mie iscrizioni"
      eyebrow="Iscrizioni"
      description="Le tappe a cui sei iscritto, i risultati e la tua stagione. Puoi annullare un'iscrizione fino alla scadenza."
    >
      <Suspense fallback={<MieIscrizioniLoading />}>
        <MieIscrizioniContent />
      </Suspense>
    </PageContainer>
  );
}
