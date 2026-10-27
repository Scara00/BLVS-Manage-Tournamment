import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { AvvioFase } from "@/components/admin-avvio-fase";
import { GestioneTappaLoading } from "@/components/admin-tappa";
import { PageContainer } from "@/components/layout/page-container";
import { avviaFase } from "@/lib/tappe/avvio/actions";
import { parseCategoriaSegmento } from "@/lib/tappe/avvio/paths";
import { readAvvioFase } from "@/lib/tappe/avvio/read";

export const metadata: Metadata = { title: "Avvio fase · Amministrazione" };

/**
 * Cache Components needs one sample to prerender the shell (the admin
 * shell reads the pathname); other stages and boards render on request.
 */
export function generateStaticParams() {
  return [{ id: "cagliari", categoria: "m" }];
}

async function AvvioContent({
  id,
  segmento,
}: {
  id: string;
  segmento: string;
}) {
  const categoria = parseCategoriaSegmento(segmento);
  if (!categoria) notFound();
  const view = await readAvvioFase(id, categoria);
  return <AvvioFase view={view} action={avviaFase} />;
}

export default function AvvioFasePage({
  params,
}: PageProps<"/admin/tappe/[id]/avvio/[categoria]">) {
  return (
    <PageContainer
      title="Avvio fase"
      eyebrow="Amministrazione · Tappe"
      description="Controlla i gironi e crea le partite dei gironi iniziali, un tabellone alla volta."
    >
      <Suspense
        fallback={<GestioneTappaLoading testo="Caricamento dei gironi…" />}
      >
        {params.then(({ id, categoria }) => (
          <AvvioContent id={decodeURIComponent(id)} segmento={categoria} />
        ))}
      </Suspense>
    </PageContainer>
  );
}
