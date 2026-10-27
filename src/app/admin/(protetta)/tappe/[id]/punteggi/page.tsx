import type { Metadata } from "next";
import { Suspense } from "react";
import { ElencoPunteggiView } from "@/components/admin-punteggio";
import { GestioneTappaLoading } from "@/components/admin-tappa";
import { PageContainer } from "@/components/layout/page-container";
import { readElencoPunteggi } from "@/lib/punteggi/read";

export const metadata: Metadata = { title: "Punteggi · Amministrazione" };

/**
 * Cache Components needs one sample to prerender the shell (the admin
 * shell reads the pathname); other stages render on request.
 */
export function generateStaticParams() {
  return [{ id: "jesolo" }];
}

async function ElencoContent({ id }: { id: string }) {
  const elenco = await readElencoPunteggi(id);
  return <ElencoPunteggiView elenco={elenco} />;
}

export default function PunteggiPage({
  params,
}: PageProps<"/admin/tappe/[id]/punteggi">) {
  return (
    <PageContainer
      title="Punteggi"
      eyebrow="Amministrazione · Tappe"
      description="Le partite dei gironi della tappa: inserisci o correggi il punteggio a bordo campo."
    >
      <Suspense
        fallback={<GestioneTappaLoading testo="Caricamento delle partite…" />}
      >
        {params.then(({ id }) => (
          <ElencoContent id={decodeURIComponent(id)} />
        ))}
      </Suspense>
    </PageContainer>
  );
}
