import type { Metadata } from "next";
import { Suspense } from "react";
import { PageContainer } from "@/components/layout/page-container";
import type { StatoTappa } from "@/lib/db/types";
import { STATO_TAPPA_LABEL } from "@/lib/tappe/format";
import { readTappe } from "@/lib/tappe/read";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Tappe" };

const statusStyle: Record<StatoTappa, string> = {
  bozza: "bg-reg-draft-bg text-reg-draft-fg",
  iscrizioni_aperte: "bg-reg-open-bg text-reg-open-fg",
  iscrizioni_chiuse: "bg-reg-closed-bg text-reg-closed-fg",
  in_corso: "bg-live-bg text-live-fg",
  conclusa: "bg-reg-closed-bg text-reg-closed-fg",
  annullata: "bg-reg-cancelled-bg text-reg-cancelled-fg",
  archiviata: "bg-tape text-primary",
};

async function TappeList() {
  const tappe = await readTappe();
  if (tappe.length === 0) {
    return (
      <p className="border border-dashed border-input p-inset-lg text-muted-foreground">
        Nessuna tappa in calendario per ora.
      </p>
    );
  }
  return (
    <ul className="grid gap-stack md:grid-cols-2 lg:grid-cols-3">
      {tappe.map((stage) => (
        <li
          key={stage.id}
          className="flex flex-col gap-space-3 border border-border p-inset-lg"
        >
          <p
            className={cn(
              "self-start px-space-2 py-space-1 text-xs font-semibold tracking-wide uppercase",
              statusStyle[stage.stato],
            )}
          >
            {STATO_TAPPA_LABEL[stage.stato]}
          </p>
          <h2 className="font-heading text-xl font-semibold">{stage.name}</h2>
          <p className="text-muted-foreground">{stage.place}</p>
          <p className="font-medium">{stage.date}</p>
        </li>
      ))}
    </ul>
  );
}

export default function TappePage() {
  return (
    <PageContainer
      title="Tappe"
      eyebrow="Circuito 2026"
      description="Il calendario delle tappe del circuito, con luogo, date e stato delle iscrizioni."
    >
      <Suspense
        fallback={
          <p className="text-muted-foreground" aria-busy="true">
            Caricamento delle tappe…
          </p>
        }
      >
        <TappeList />
      </Suspense>
    </PageContainer>
  );
}
