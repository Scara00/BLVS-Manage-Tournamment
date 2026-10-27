import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { PageContainer } from "@/components/layout/page-container";
import { isErrorPreviewEnabled } from "@/lib/errors/preview";
import { PunteggioFixtureForm } from "./fixture-form";

export const metadata: Metadata = {
  title: "Anteprima punteggio · Amministrazione",
};

/**
 * Dev/e2e only: a score form that saves through the device queue
 * (BLVS-33), until BLVS-32's score screen adopts `useCodaPunteggi()`.
 */
export default function AnteprimaPunteggio() {
  if (!isErrorPreviewEnabled()) notFound();
  return (
    <PageContainer
      title="Anteprima punteggio"
      eyebrow="Amministrazione"
      description="Modulo di prova per la coda dei punteggi offline."
    >
      <Suspense fallback={null}>
        <PunteggioFixtureForm />
      </Suspense>
    </PageContainer>
  );
}
