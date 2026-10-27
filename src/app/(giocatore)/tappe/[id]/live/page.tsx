import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { PageContainer } from "@/components/layout/page-container";
import {
  LiveLoading,
  LiveTappa,
  LiveTappaSessioneScaduta,
} from "@/components/live";
import { readLiveTappa } from "@/lib/live/tappa-read";

export const metadata: Metadata = { title: "Live della tappa" };

/**
 * Cache Components needs one sample to prerender the shell (AppShell reads
 * the pathname). Other ids render on request; drafts and unknown ids are a
 * real 404 from the proxy (`rewriteTappaNonTrovata`).
 */
export function generateStaticParams() {
  return [{ id: "jesolo" }];
}

async function LiveTappaContent({ id }: { id: string }) {
  const live = await readLiveTappa(id);
  if (live.status === "notFound") notFound();
  if (live.status === "sessionExpired") {
    return <LiveTappaSessioneScaduta tappaId={live.tappa.id} />;
  }
  return (
    <>
      <p
        className="font-heading text-lg font-semibold"
        data-testid="live-tappa-nome"
      >
        {live.tappa.nome}
      </p>
      <LiveTappa
        tappaId={live.tappa.id}
        initial={live.sync}
        me={live.me}
        fasi={live.fasi}
      />
    </>
  );
}

/** w-live (BLVS-36): the player's live screen of one stage. */
export default function LiveTappaPage({
  params,
}: PageProps<"/tappe/[id]/live">) {
  return (
    <PageContainer
      title="Live della tappa"
      eyebrow="Tappe"
      description="La tua partita e il tuo girone, poi le partite in campo. Si aggiorna da sola."
    >
      <Suspense fallback={<LiveLoading what="del live della tappa" />}>
        {params.then(({ id }) => (
          <LiveTappaContent id={decodeURIComponent(id)} />
        ))}
      </Suspense>
    </PageContainer>
  );
}
