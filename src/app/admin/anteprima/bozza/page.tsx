import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageContainer } from "@/components/layout/page-container";
import { isErrorPreviewEnabled } from "@/lib/errors/preview";
import { DraftFixtureForm } from "./fixture-form";

export const metadata: Metadata = {
  title: "Anteprima bozza · Amministrazione",
};

/** Dev/e2e only: a form with a local draft inside the admin shell. */
export default function AnteprimaBozza() {
  if (!isErrorPreviewEnabled()) notFound();
  return (
    <PageContainer
      title="Anteprima bozza"
      eyebrow="Amministrazione"
      description="Modulo di prova per l'avviso di scadenza della sessione."
    >
      <DraftFixtureForm />
    </PageContainer>
  );
}
