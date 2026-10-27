import type { Metadata } from "next";
import { Suspense } from "react";
import { GestioneTappa, GestioneTappaLoading } from "@/components/admin-tappa";
import { PageContainer } from "@/components/layout/page-container";
import { aggiornaScadenzaTappa, cambiaStatoTappa } from "@/lib/tappe/actions";
import { archiviaTappa } from "@/lib/tappe/annullamento/actions";
import { readGestioneTappa } from "@/lib/tappe/gestione";

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
  const tappa = await readGestioneTappa(id);
  return (
    <GestioneTappa
      tappa={tappa}
      cambiaStato={cambiaStatoTappa}
      aggiornaScadenza={aggiornaScadenzaTappa}
      archivia={archiviaTappa}
    />
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
