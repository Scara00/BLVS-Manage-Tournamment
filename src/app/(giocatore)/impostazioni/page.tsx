import type { Metadata } from "next";
import { Suspense } from "react";
import { ImpostazioniView } from "@/components/impostazioni";
import { PageContainer } from "@/components/layout/page-container";
import { ProfiloLoading, ProfiloSessioneScaduta } from "@/components/profilo";
import { cambiaPassword } from "@/lib/impostazioni/actions";
import { getImpostazioni } from "@/lib/impostazioni/read";
import { IMPOSTAZIONI_PATH } from "@/lib/impostazioni/types";

export const metadata: Metadata = { title: "Impostazioni" };

async function ImpostazioniContent() {
  const impostazioni = await getImpostazioni();
  if (!impostazioni) return <ProfiloSessioneScaduta from={IMPOSTAZIONI_PATH} />;
  return (
    <ImpostazioniView
      impostazioni={impostazioni}
      cambiaPassword={cambiaPassword}
    />
  );
}

/** w-impostazioni (BLVS-53). */
export default function ImpostazioniPage() {
  return (
    <PageContainer
      title="Impostazioni"
      eyebrow="Account"
      description="Password, consenso privacy e cancellazione dell'account."
    >
      <Suspense fallback={<ProfiloLoading />}>
        <ImpostazioniContent />
      </Suspense>
    </PageContainer>
  );
}
