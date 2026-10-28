import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { PageContainer } from "@/components/layout/page-container";
import { LiveLoading } from "@/components/live";
import { SchedaGiocatoreLive } from "@/components/scheda-giocatore";
import {
  idClassifica,
  readSchedaGiocatore,
} from "@/lib/classifica-generale/read";
import { DEMO_ME_CLASSIFICA } from "@/lib/demo/classifica-generale";

// No personal name in <title>: it outlives the page in history and tabs.
export const metadata: Metadata = { title: "Scheda del giocatore" };

type Ricerca = Record<string, string | string[] | undefined>;

const primo = (v: string | string[] | undefined) =>
  Array.isArray(v) ? v[0] : v;

/**
 * Cache Components needs one sample to prerender the shell. Other ids
 * render on request; a player not in the standing is `notFound()`.
 */
export function generateStaticParams() {
  return [{ id: DEMO_ME_CLASSIFICA }];
}

async function SchedaContent({
  id,
  searchParams,
}: {
  id: string;
  searchParams: Promise<Ricerca>;
}) {
  const params = await searchParams;
  const vista = await readSchedaGiocatore(id, {
    categoria: primo(params.categoria),
    stagione: primo(params.stagione),
  });
  if (!vista) notFound();
  const standingsId = idClassifica(vista.categoria, vista.stagione);
  return (
    <SchedaGiocatoreLive
      key={standingsId}
      initial={vista.sync}
      standingsId={standingsId}
      utenteId={vista.utenteId}
      categoria={vista.categoria}
      stagione={vista.stagione}
      me={vista.me}
    />
  );
}

/**
 * w-giocatore (BLVS-50): one player of the overall standing, stage by
 * stage, live. Public like w-classifica: names and points only, and a
 * deleted account is «Giocatore anonimo».
 */
export default function SchedaGiocatorePage({
  params,
  searchParams,
}: PageProps<"/classifica/giocatore/[id]">) {
  return (
    <PageContainer
      title="Scheda del giocatore"
      eyebrow="Classifica"
      description="Posizione, punti e fase raggiunta in ogni tappa della stagione. Si aggiorna da sola."
    >
      <Suspense fallback={<LiveLoading what="della scheda del giocatore" />}>
        {params.then(({ id }) => (
          <SchedaContent
            id={decodeURIComponent(id)}
            searchParams={searchParams}
          />
        ))}
      </Suspense>
    </PageContainer>
  );
}
