import type { Metadata } from "next";
import { Suspense } from "react";
import { PageContainer } from "@/components/layout/page-container";
import { Regole, RegoleSessioneScaduta } from "@/components/regole";
import { REASON_PARAM } from "@/lib/navigation/auth-paths";

export const metadata: Metadata = { title: "Regole e punteggi" };

type Ricerca = Record<string, string | string[] | undefined>;

/** `?motivo=scaduta`: the expired-session banner above the rules. */
async function AvvisoSessione({
  searchParams,
}: {
  searchParams: Promise<Ricerca>;
}) {
  const motivo = (await searchParams)[REASON_PARAM];
  return motivo === "scaduta" ? <RegoleSessioneScaduta /> : null;
}

/**
 * w-regole (BLVS-46): format, tie-breaks and points, generated from the
 * circuit's configuration. Public and prerendered; only the banner reads
 * the request.
 */
export default function RegolePage({ searchParams }: PageProps<"/regole">) {
  return (
    <PageContainer
      title="Regole e punteggi"
      eyebrow="Circuito"
      description="Come si gioca una tappa, come si decidono le parità e quanti punti vale ogni posizione."
    >
      <Suspense fallback={null}>
        <AvvisoSessione searchParams={searchParams} />
      </Suspense>
      <Regole />
    </PageContainer>
  );
}
