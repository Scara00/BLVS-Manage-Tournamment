import type { Metadata } from "next";
import { Suspense } from "react";
import {
  ClassificaGeneraleLive,
  SceltaCategoria,
  SceltaStagione,
} from "@/components/classifica-generale";
import { PageContainer } from "@/components/layout/page-container";
import { LiveLoading } from "@/components/live";
import { FILTRO_STAGIONE_ATTIVO } from "@/lib/classifica-generale/stagione";
import {
  idClassifica,
  readClassificaGenerale,
} from "@/lib/classifica-generale/read";

export const metadata: Metadata = { title: "Classifica" };

type Ricerca = Record<string, string | string[] | undefined>;

const primo = (v: string | string[] | undefined) =>
  Array.isArray(v) ? v[0] : v;

async function ClassificaContent({
  searchParams,
}: {
  searchParams: Promise<Ricerca>;
}) {
  const params = await searchParams;
  const vista = await readClassificaGenerale({
    categoria: primo(params.categoria),
    stagione: primo(params.stagione),
  });
  const id = idClassifica(vista.categoria, vista.stagione);
  return (
    <div className="flex flex-col gap-stack">
      <div className="flex flex-wrap items-end justify-between gap-stack">
        <SceltaCategoria
          categoria={vista.categoria}
          stagione={vista.stagione}
        />
        {FILTRO_STAGIONE_ATTIVO ? (
          <SceltaStagione
            categoria={vista.categoria}
            stagione={vista.stagione}
            stagioni={vista.stagioni}
          />
        ) : null}
      </div>
      <ClassificaGeneraleLive
        key={id}
        initial={vista.sync}
        standingsId={id}
        categoria={vista.categoria}
        stagione={vista.stagione}
        me={vista.me}
      />
    </div>
  );
}

/**
 * w-classifica (BLVS-44): the sum of the stage points per player, per
 * category and season, live. Public: names and points only.
 */
export default function ClassificaPage({
  searchParams,
}: PageProps<"/classifica">) {
  return (
    <PageContainer
      title="Classifica"
      eyebrow="Circuito"
      description="La classifica generale: i punti di tutte le tappe giocate, sommati per giocatore e aggiornati in tempo reale."
    >
      <Suspense fallback={<LiveLoading what="della classifica" />}>
        <ClassificaContent searchParams={searchParams} />
      </Suspense>
    </PageContainer>
  );
}
