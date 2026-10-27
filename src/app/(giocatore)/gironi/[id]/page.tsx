import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { PageContainer } from "@/components/layout/page-container";
import {
  LiveAnnouncer,
  LiveBarConnected,
  LiveGroupStandings,
  LiveLoading,
  LiveMatches,
  LiveProvider,
} from "@/components/live";
import { demoGroups } from "@/lib/demo/tournament";
import { readLiveSync } from "@/lib/live/read";

export function generateStaticParams() {
  return demoGroups.map((group) => ({ id: group.id }));
}

function findGroup(id: string) {
  return demoGroups.find((group) => group.id === id);
}

export async function generateMetadata({
  params,
}: PageProps<"/gironi/[id]">): Promise<Metadata> {
  const group = findGroup((await params).id);
  return { title: group?.label ?? "Girone" };
}

async function GironeContent({ groupId }: { groupId: string }) {
  const initial = await readLiveSync();
  return (
    <LiveProvider initial={initial}>
      <div className="flex flex-col gap-stack-lg">
        <LiveBarConnected />
        <LiveAnnouncer groupId={groupId} />
        <LiveGroupStandings groupId={groupId} />
        <section
          aria-labelledby="partite-girone"
          className="flex flex-col gap-stack"
        >
          <h2
            id="partite-girone"
            className="font-heading text-xl font-semibold"
          >
            Partite in corso
          </h2>
          <LiveMatches groupId={groupId} />
        </section>
      </div>
    </LiveProvider>
  );
}

export default async function GironePage({
  params,
}: PageProps<"/gironi/[id]">) {
  const { id } = await params;
  const group = findGroup(id);
  if (!group) notFound();

  return (
    <PageContainer
      title={group.label}
      eyebrow="Tappa 1 · Jesolo"
      description="Classifica del girone e partite in corso, aggiornate in tempo reale."
    >
      <Suspense fallback={<LiveLoading what="del girone" />}>
        <GironeContent groupId={group.id} />
      </Suspense>
    </PageContainer>
  );
}
