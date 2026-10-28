import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { AdminLive, AdminLiveLoading } from "@/components/admin-live";
import { ParitaGirone } from "@/components/admin-parita";
import { PageContainer } from "@/components/layout/page-container";
import {
  LiveAnnouncer,
  LiveBarConnected,
  LiveProvider,
} from "@/components/live";
import { risolviParita } from "@/lib/gironi/parita/actions";
import { readParitaTabellone } from "@/lib/gironi/parita/read";
import { readLiveSync } from "@/lib/live/read";
import { registraRitiro } from "@/lib/ritiri/actions";
import { readAssenzeTabellone } from "@/lib/ritiri/read";
import { parseCategoriaSegmento } from "@/lib/tappe/avvio/paths";
import { concludiTabellone } from "@/lib/tappe/chiusura/actions";
import { readClassificaTappa } from "@/lib/tappe/classifica/read";
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
  // After the admin check of readAdminLive. BLVS-38: a finished group with
  // a perfect tie shows it under its name.
  const [parita, assenze, classifica] = await Promise.all([
    readParitaTabellone(view.tappa.id, categoria),
    // BLVS-42: withdrawals and absences shown under each group.
    readAssenzeTabellone(view.tappa.id, categoria),
    // BLVS-40/43: the stage points, provisional until the board is closed.
    readClassificaTappa(view.tappa.id, categoria),
  ]);
  const extraGironi = Object.fromEntries(
    parita
      .filter((g) => g.parita.length > 0)
      .map((g) => [
        g.gironeId,
        <ParitaGirone
          key={g.gironeId}
          girone={g}
          risolvi={risolviParita}
          className="border-2 border-primary p-space-3"
        />,
      ]),
  );
  return (
    <LiveProvider initial={initial}>
      <div className="flex flex-col gap-stack">
        <LiveBarConnected />
        <LiveAnnouncer
          types={["board-matches", "board-closed"]}
          groupId={chiaveTabellone(view.tappa.id, categoria)}
        />
        <AdminLive
          view={view}
          azione={aggiornaPartita}
          punteggio={salvaPunteggio}
          extraGironi={extraGironi}
          ritiro={{ action: registraRitiro, assenze }}
          chiusura={concludiTabellone}
          classifica={classifica}
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
