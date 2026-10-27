import type { Metadata } from "next";
import { Suspense } from "react";
import { InserimentoPunteggio } from "@/components/admin-punteggio";
import { GestioneTappaLoading } from "@/components/admin-tappa";
import { PageContainer } from "@/components/layout/page-container";
import {
  annullaPunteggio,
  salvaParziale,
  salvaPunteggio,
} from "@/lib/punteggi/actions";
import { readSchedaPunteggio } from "@/lib/punteggi/read";

export const metadata: Metadata = {
  title: "Inserimento punteggio · Amministrazione",
};

/**
 * Cache Components needs one sample to prerender the shell (the admin
 * shell reads the pathname); other matches render on request.
 */
export function generateStaticParams() {
  return [{ id: "jesolo", partitaId: "jesolo-M-g1-t2" }];
}

async function SchedaContent({
  id,
  partitaId,
}: {
  id: string;
  partitaId: string;
}) {
  const scheda = await readSchedaPunteggio(id, partitaId);
  return (
    <InserimentoPunteggio
      key={scheda.partita.id}
      scheda={scheda}
      salva={salvaPunteggio}
      annulla={annullaPunteggio}
      inviaParziale={salvaParziale}
    />
  );
}

export default function PunteggioPage({
  params,
}: PageProps<"/admin/tappe/[id]/punteggi/[partitaId]">) {
  return (
    <PageContainer
      title="Inserimento punteggio"
      eyebrow="Amministrazione · Punteggi"
      description="Un set a 21: inserisci i punti delle due coppie, controlla il riepilogo e salva."
    >
      <Suspense
        fallback={<GestioneTappaLoading testo="Caricamento della partita…" />}
      >
        {params.then(({ id, partitaId }) => (
          <SchedaContent
            id={decodeURIComponent(id)}
            partitaId={decodeURIComponent(partitaId)}
          />
        ))}
      </Suspense>
    </PageContainer>
  );
}
