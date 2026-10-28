import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { PageContainer } from "@/components/layout/page-container";
import { LiveLoading } from "@/components/live";
import {
  TabelloneLive,
  TabelloneSessioneScaduta,
} from "@/components/tabellone";
import { readTabelloneGiocatore } from "@/lib/tabellone/read";

export const metadata: Metadata = { title: "Gironi e fasi" };

/**
 * Cache Components needs one sample to prerender the shell (AppShell reads
 * the pathname). Other ids render on request; drafts and unknown ids are a
 * real 404 from the proxy (`rewriteTappaNonTrovata`).
 */
export function generateStaticParams() {
  return [{ id: "jesolo" }];
}

async function TabelloneContent({ id }: { id: string }) {
  const vista = await readTabelloneGiocatore(id);
  if (vista.status === "notFound") notFound();
  if (vista.status === "sessionExpired") {
    return <TabelloneSessioneScaduta tappaId={vista.tappa.id} />;
  }
  return (
    <>
      <p
        className="font-heading text-lg font-semibold"
        data-testid="tabellone-tappa-nome"
      >
        {vista.tappa.nome}
      </p>
      <TabelloneLive
        tappaId={vista.tappa.id}
        initial={vista.sync}
        me={vista.me}
      />
    </>
  );
}

/** w-tabellone (BLVS-48): the groups and phases of one stage. */
export default function TabellonePage({
  params,
}: PageProps<"/tappe/[id]/tabellone">) {
  return (
    <PageContainer
      title="Gironi e fasi"
      eyebrow="Tappe"
      description="Le fasi dei tabelloni, la tua posizione e tutti i gironi con la linea di taglio. Si aggiorna da sola."
    >
      <Suspense fallback={<LiveLoading what="dei gironi" />}>
        {params.then(({ id }) => (
          <TabelloneContent id={decodeURIComponent(id)} />
        ))}
      </Suspense>
    </PageContainer>
  );
}
