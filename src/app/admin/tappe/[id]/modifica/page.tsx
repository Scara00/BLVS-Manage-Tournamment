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
  tappaPath,
} from "@/lib/tappe/modifica/types";

export const metadata: Metadata = { title: "Modifica tappa · Amministrazione" };

/**
 * Cache Components needs one sample to prerender the shell (the admin
 * shell reads the pathname); every other id renders on request.
 */
export function generateStaticParams() {
  return [{ id: "rimini" }];
}

async function ModificaContent({ id }: { id: string }) {
  const lettura = await readTappaModifica(id);
  if (lettura.status === "notFound") notFound();
  if (lettura.status === "sessionExpired") {
    return <TappaModificaSessioneScaduta from={tappaModificaPath(id)} />;
  }
  const { tappa } = lettura;
  if (STATI_NON_MODIFICABILI.includes(tappa.stato)) {
    return (
      <TappaNonModificabile
        nome={tappa.nome}
        stato={tappa.stato}
        backHref={tappaPath(tappa.id)}
      />
    );
  }
  return (
    <TappaModificaForm
      tappa={tappa}
      action={aggiornaTappa}
      backHref={tappaPath(tappa.id)}
    />
  );
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
        {params.then(({ id }) => (
          <ModificaContent id={decodeURIComponent(id)} />
        ))}
      </Suspense>
    </PageContainer>
  );
}
