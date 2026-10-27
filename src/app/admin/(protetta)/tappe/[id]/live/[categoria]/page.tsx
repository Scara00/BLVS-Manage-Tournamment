import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { AdminLive, AdminLiveLoading } from "@/components/admin-live";
import { PageContainer } from "@/components/layout/page-container";
import {
  LiveAnnouncer,
  LiveBarConnected,
  LiveProvider,
} from "@/components/live";
import { readLiveSync } from "@/lib/live/read";
import { parseCategoriaSegmento } from "@/lib/tappe/avvio/paths";
import {
  aggiornaPartita,
  salvaPunteggio,
} from "@/lib/tappe/live-admin/actions";
import { readAdminLive } from "@/lib/tappe/live-admin/read";
import { chiaveTabellone } from "@/lib/tappe/live-admin/types";

export const metadata: Metadata = { title: "Gestione live · Amministrazione" };

/**
 * Cache Components needs one sample to prerender the shell (the admin
 * shell reads the pathname); other stages and boards render on request.
 */
export function generateStaticParams() {
  return [{ id: "jesolo", categoria: "m" }];
}

async function LiveContent({ id, segmento }: { id: string; segmento: string }) {
  const categoria = parseCategoriaSegmento(segmento);
  if (!categoria) notFound();
  const [view, initial] = await Promise.all([
    readAdminLive(id, categoria),
    readLiveSync(),
  ]);
  return (
    <LiveProvider initial={initial}>
      <div className="flex flex-col gap-stack">
        <LiveBarConnected />
        <LiveAnnouncer
          types={["board-matches"]}
          groupId={chiaveTabellone(view.tappa.id, categoria)}
        />
        <AdminLive
          view={view}
          azione={aggiornaPartita}
          punteggio={salvaPunteggio}
        />
      </div>
    </LiveProvider>
  );
}

export default function AdminLivePage({
  params,
}: PageProps<"/admin/tappe/[id]/live/[categoria]">) {
  return (
    <PageContainer
      title="Gestione live"
      eyebrow="Amministrazione · Tappe"
      description="Le partite in corso, tutte le partite per fase e girone e l'avanzamento della fase, aggiornati in tempo reale."
    >
      <Suspense fallback={<AdminLiveLoading />}>
        {params.then(({ id, categoria }) => (
          <LiveContent id={decodeURIComponent(id)} segmento={categoria} />
        ))}
      </Suspense>
    </PageContainer>
  );
}
