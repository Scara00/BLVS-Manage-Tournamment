import type { Metadata } from "next";
import { PageContainer } from "@/components/layout/page-container";
import { demoLiveMatches } from "@/lib/demo/tournament";

export const metadata: Metadata = { title: "Live" };

export default function LivePage() {
  return (
    <PageContainer
      title="Live"
      eyebrow="Tappa 1 · Jesolo"
      description="Le partite in corso, campo per campo."
    >
      <ul className="grid gap-stack md:grid-cols-2">
        {demoLiveMatches.map((match) => (
          <li
            key={match.id}
            className="flex flex-col gap-space-3 border border-border p-inset-lg"
          >
            <div className="flex flex-wrap items-center gap-space-3">
              <p className="bg-live-bg px-space-2 py-space-1 text-xs font-semibold tracking-wide text-live-fg uppercase">
                Live
              </p>
              <p className="text-sm text-muted-foreground">{match.court}</p>
            </div>
            <h2 className="font-heading text-lg font-semibold">
              {match.home} <span className="font-normal">contro</span>{" "}
              {match.away}
            </h2>
            <p className="font-mono text-2xl font-semibold">{match.score}</p>
          </li>
        ))}
      </ul>
    </PageContainer>
  );
}
