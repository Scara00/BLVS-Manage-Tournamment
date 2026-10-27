import type { Metadata } from "next";
import { Suspense } from "react";
import { PageContainer } from "@/components/layout/page-container";
import {
  LiveAnnouncer,
  LiveBarConnected,
  LiveLoading,
  LiveOverallStandings,
  LiveProvider,
} from "@/components/live";
import { readLiveSync } from "@/lib/live/read";

export const metadata: Metadata = { title: "Classifica" };

async function ClassificaContent() {
  const initial = await readLiveSync();
  return (
    <LiveProvider initial={initial}>
      <div className="flex flex-col gap-stack">
        <LiveBarConnected />
        <LiveAnnouncer types={["overall-standings"]} />
        <LiveOverallStandings />
      </div>
    </LiveProvider>
  );
}

export default function ClassificaPage() {
  return (
    <PageContainer
      title="Classifica"
      eyebrow="Circuito 2026"
      description="La classifica generale del circuito, aggiornata dopo ogni tappa."
    >
      <Suspense fallback={<LiveLoading what="della classifica" />}>
        <ClassificaContent />
      </Suspense>
    </PageContainer>
  );
}
