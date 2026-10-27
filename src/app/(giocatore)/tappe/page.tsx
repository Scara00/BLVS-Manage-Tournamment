import type { Metadata } from "next";
import { Suspense } from "react";
import { PageContainer } from "@/components/layout/page-container";
import { TappeElenco, TappeLoading } from "@/components/tappe";
import { readElencoTappe } from "@/lib/tappe/read";

export const metadata: Metadata = { title: "Tappe" };

async function TappeList() {
  const { tappe, connesso } = await readElencoTappe();
  return <TappeElenco tappe={tappe} connesso={connesso} />;
}

export default function TappePage() {
  return (
    <PageContainer
      title="Tappe"
      eyebrow="Circuito 2026"
      description="Il calendario delle tappe del circuito: date, luogo, scadenza delle iscrizioni e posti liberi nella tua categoria."
    >
      <Suspense fallback={<TappeLoading />}>
        <TappeList />
      </Suspense>
    </PageContainer>
  );
}
