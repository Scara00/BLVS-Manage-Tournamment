import type { Metadata } from "next";
import { Suspense } from "react";
import { PageContainer } from "@/components/layout/page-container";
import {
  ProfiloLoading,
  ProfiloSessioneScaduta,
  ProfiloView,
} from "@/components/profilo";
import { getProfilo } from "@/lib/profilo/read";
import { PROFILO_PATH } from "@/lib/profilo/types";

export const metadata: Metadata = { title: "Profilo" };

async function ProfiloContent() {
  const profilo = await getProfilo();
  if (!profilo) return <ProfiloSessioneScaduta from={PROFILO_PATH} />;
  return <ProfiloView profilo={profilo} />;
}

export default function ProfiloPage() {
  return (
    <PageContainer
      title="Il tuo profilo"
      eyebrow="Profilo"
      description="I tuoi dati personali e la categoria in cui giochi."
    >
      <Suspense fallback={<ProfiloLoading />}>
        <ProfiloContent />
      </Suspense>
    </PageContainer>
  );
}
