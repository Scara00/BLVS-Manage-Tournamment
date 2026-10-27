import type { Metadata } from "next";
import { PageContainer } from "@/components/layout/page-container";
import { demoStages, type DemoStage } from "@/lib/demo/tournament";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Tappe" };

const statusStyle: Record<DemoStage["status"], string> = {
  "In corso": "bg-live-bg text-live-fg",
  "Iscrizioni aperte": "bg-reg-open-bg text-reg-open-fg",
  "Iscrizioni chiuse": "bg-reg-closed-bg text-reg-closed-fg",
};

export default function TappePage() {
  return (
    <PageContainer
      title="Tappe"
      eyebrow="Circuito 2026"
      description="Il calendario delle tappe del circuito, con luogo, date e stato delle iscrizioni."
    >
      <ul className="grid gap-stack md:grid-cols-2 lg:grid-cols-3">
        {demoStages.map((stage) => (
          <li
            key={stage.id}
            className="flex flex-col gap-space-3 border border-border p-inset-lg"
          >
            <p
              className={cn(
                "self-start px-space-2 py-space-1 text-xs font-semibold tracking-wide uppercase",
                statusStyle[stage.status],
              )}
            >
              {stage.status}
            </p>
            <h2 className="font-heading text-xl font-semibold">{stage.name}</h2>
            <p className="text-muted-foreground">{stage.place}</p>
            <p className="font-medium">{stage.date}</p>
          </li>
        ))}
      </ul>
    </PageContainer>
  );
}
