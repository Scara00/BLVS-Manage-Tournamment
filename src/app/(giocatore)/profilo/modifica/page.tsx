import type { Metadata } from "next";
import { Suspense } from "react";
import { PageContainer } from "@/components/layout/page-container";
import {
  ProfiloForm,
  ProfiloLoading,
  ProfiloSessioneScaduta,
} from "@/components/profilo";
import { aggiornaProfilo } from "@/lib/profilo/actions";
import { getProfilo } from "@/lib/profilo/read";
import { PROFILO_MODIFICA_PATH } from "@/lib/profilo/types";

export const metadata: Metadata = { title: "Modifica profilo" };

async function ModificaContent() {
  const profilo = await getProfilo();
  if (!profilo) return <ProfiloSessioneScaduta from={PROFILO_MODIFICA_PATH} />;
  return <ProfiloForm profilo={profilo} action={aggiornaProfilo} />;
}

export default function ModificaProfiloPage() {
  return (
    <PageContainer
      title="Modifica profilo"
      eyebrow="Profilo"
      description="Aggiorna nome, cognome, email e, finché non hai giocato una tappa, la categoria."
    >
      <Suspense fallback={<ProfiloLoading />}>
        <ModificaContent />
      </Suspense>
    </PageContainer>
  );
}
