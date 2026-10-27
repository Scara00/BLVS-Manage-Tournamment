import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import {
  TappaModificaForm,
  TappaModificaLoading,
  TappaModificaSessioneScaduta,
  TappaNonModificabile,
} from "@/components/admin-tappa-modifica";
import { PageContainer } from "@/components/layout/page-container";
import { aggiornaTappa } from "@/lib/tappe/modifica/actions";
import { readTappaModifica } from "@/lib/tappe/modifica/read";
import {
  STATI_NON_MODIFICABILI,
  tappaModificaPath,
} from "@/lib/tappe/modifica/types";

export const metadata: Metadata = { title: "Modifica tappa · Amministrazione" };

async function ModificaContent({
  params,
}: {
  params: PageProps<"/admin/tappe/[id]/modifica">["params"];
}) {
  const { id } = await params;
  const lettura = await readTappaModifica(id);
  if (lettura.status === "notFound") notFound();
  if (lettura.status === "sessionExpired") {
    return <TappaModificaSessioneScaduta from={tappaModificaPath(id)} />;
  }
  const { tappa } = lettura;
  if (STATI_NON_MODIFICABILI.includes(tappa.stato)) {
    return <TappaNonModificabile nome={tappa.nome} stato={tappa.stato} />;
  }
  return <TappaModificaForm tappa={tappa} action={aggiornaTappa} />;
}

/** w-admin-tappa-modifica. */
export default function ModificaTappaPage({
  params,
}: PageProps<"/admin/tappe/[id]/modifica">) {
  return (
    <PageContainer
      title="Modifica tappa"
      eyebrow="Amministrazione · Tappe"
      description="Aggiorna nome, luogo, date, scadenza e massimo di iscritti per tabellone. Il massimo non può scendere sotto gli iscritti attuali."
    >
      <Suspense fallback={<TappaModificaLoading />}>
        <ModificaContent params={params} />
      </Suspense>
    </PageContainer>
  );
}
