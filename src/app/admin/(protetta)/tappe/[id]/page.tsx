import type { Metadata } from "next";
import { Suspense } from "react";
import { StagioneTappa } from "@/components/admin-stagione";
import { GestioneTappa, GestioneTappaLoading } from "@/components/admin-tappa";
import { PageContainer } from "@/components/layout/page-container";
import { aggiornaScadenzaTappa, cambiaStatoTappa } from "@/lib/tappe/actions";
import { readGestioneTappa } from "@/lib/tappe/gestione";
import { impostaStagioneTappa } from "@/lib/tappe/stagione/actions";
import { readStagioneTappa } from "@/lib/tappe/stagione/read";

export const metadata: Metadata = { title: "Gestione tappa · Amministrazione" };

/**
 * Cache Components needs at least one sample to prerender the shell (the
 * admin shell reads the pathname). Every other id renders on request: the
 * content reads at runtime inside Suspense.
 */
export function generateStaticParams() {
  return [{ id: "rimini" }];
}

async function GestioneContent({ id }: { id: string }) {
  const [tappa, stagione] = await Promise.all([
    readGestioneTappa(id),
    readStagioneTappa(id),
  ]);
  return (
    <div className="flex flex-col gap-stack-lg">
      <GestioneTappa
        tappa={tappa}
        cambiaStato={cambiaStatoTappa}
        aggiornaScadenza={aggiornaScadenzaTappa}
      />
      {stagione ? (
        <StagioneTappa
          tappaId={tappa.id}
          stagione={stagione.stagione}
          modificabile={stagione.modificabile}
          action={impostaStagioneTappa}
        />
      ) : null}
    </div>
  );
}

export default function GestioneTappaPage({
  params,
}: PageProps<"/admin/tappe/[id]">) {
  return (
    <PageContainer
      title="Gestione tappa"
      eyebrow="Amministrazione · Tappe"
      description="Apri e chiudi le iscrizioni, imposta la scadenza e controlla i tabelloni."
    >
      <Suspense fallback={<GestioneTappaLoading />}>
        {params.then(({ id }) => (
          <GestioneContent id={decodeURIComponent(id)} />
        ))}
      </Suspense>
    </PageContainer>
  );
}
