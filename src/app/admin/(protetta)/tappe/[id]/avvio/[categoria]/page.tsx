import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { AvvioFase } from "@/components/admin-avvio-fase";
import { GestioneTappaLoading } from "@/components/admin-tappa";
import { ProssimaFase } from "@/components/admin-fasi";
import { PageContainer } from "@/components/layout/page-container";
import { proponiProssimaFase } from "@/lib/gironi/fasi/actions";
import { readProssimaFase } from "@/lib/gironi/fasi/read";
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
  const [view, finali] = await Promise.all([
    readAvvioFase(id, categoria),
    readProssimaFase(id, categoria, "finali"),
  ]);
  return (
    <div className="flex flex-col gap-stack-lg">
      {finali ? (
        <ProssimaFase
          key={`${id}:${categoria}`}
          view={finali}
          action={proponiProssimaFase}
        />
      ) : null}
      <AvvioFase view={view} action={avviaFase} />
    </div>
  );
}

export default function AvvioFasePage({
  params,
}: PageProps<"/admin/tappe/[id]/avvio/[categoria]">) {
  return (
    <PageContainer
      title="Avvio fase"
      eyebrow="Amministrazione · Tappe"
      description="Controlla i gironi e crea le partite della fase: gironi iniziali, poi gironi gold e silver e finali, un tabellone alla volta."
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
