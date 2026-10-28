import type { Metadata } from "next";
import { Suspense } from "react";
import { EliminaAccount } from "@/components/impostazioni";
import { PageContainer } from "@/components/layout/page-container";
import { ProfiloLoading, ProfiloSessioneScaduta } from "@/components/profilo";
import { cancellaAccount } from "@/lib/impostazioni/actions";
import { getImpostazioni } from "@/lib/impostazioni/read";
import { ELIMINA_ACCOUNT_PATH } from "@/lib/impostazioni/types";

export const metadata: Metadata = { title: "Cancella l'account" };

async function EliminaAccountContent() {
  const impostazioni = await getImpostazioni();
  if (!impostazioni)
    return <ProfiloSessioneScaduta from={ELIMINA_ACCOUNT_PATH} />;
  return <EliminaAccount riga={impostazioni.riga} action={cancellaAccount} />;
}

/** w-elimina-account (BLVS-53). */
export default function EliminaAccountPage() {
  return (
    <PageContainer
      title="Cancella l'account"
      eyebrow="Impostazioni"
      description="Prima di confermare, guarda cosa cambia nella classifica."
    >
      <Suspense fallback={<ProfiloLoading />}>
        <EliminaAccountContent />
      </Suspense>
    </PageContainer>
  );
}
