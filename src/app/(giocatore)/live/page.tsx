import type { Metadata } from "next";
import { Suspense } from "react";
import { PageContainer } from "@/components/layout/page-container";
import {
  LiveAnnouncer,
  LiveBarConnected,
  LiveLoading,
  LiveMatches,
  LiveProvider,
} from "@/components/live";
import { readLiveSync } from "@/lib/live/read";

export const metadata: Metadata = { title: "Live" };

async function LiveContent() {
  const initial = await readLiveSync();
  return (
    <LiveProvider initial={initial}>
      <div className="flex flex-col gap-stack">
        <LiveBarConnected />
        <LiveAnnouncer types={["score", "group-standings", "phase-started"]} />
        <LiveMatches />
      </div>
    </LiveProvider>
  );
}

export default function LivePage() {
  return (
    <PageContainer
      title="Live"
      eyebrow="Tappa 1 · Jesolo"
      description="Le partite in corso, campo per campo."
    >
      <Suspense fallback={<LiveLoading what="delle partite" />}>
        <LiveContent />
      </Suspense>
    </PageContainer>
  );
}
