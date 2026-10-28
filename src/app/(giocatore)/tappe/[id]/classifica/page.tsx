import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import {
  ClassificaTappaLive,
  SceltaCategoriaTappa,
} from "@/components/classifica-tappa";
import { PageContainer } from "@/components/layout/page-container";
import { LiveLoading } from "@/components/live";
import { readVistaClassificaTappa } from "@/lib/tappe/classifica/read";
import { liveTappaHref, tappaHref } from "@/lib/tappe/paths";

export const metadata: Metadata = { title: "Classifica di tappa" };

type Ricerca = Record<string, string | string[] | undefined>;

const primo = (v: string | string[] | undefined) =>
  Array.isArray(v) ? v[0] : v;

/**
 * Cache Components needs one sample to prerender the shell (AppShell reads
 * the pathname). Other ids render on request; drafts and unknown ids are a
 * real 404 from the proxy (`rewriteTappaNonTrovata`).
 */
export function generateStaticParams() {
  return [{ id: "jesolo" }];
}

async function ClassificaTappaContent({
  id,
  searchParams,
}: {
  id: string;
  searchParams: Promise<Ricerca>;
}) {
  const vista = await readVistaClassificaTappa(
    id,
    primo((await searchParams).categoria),
  );
  if (vista.status === "notFound") notFound();
  return (
    <div className="flex flex-col gap-stack">
      <p
        className="font-heading text-lg font-semibold"
        data-testid="classifica-tappa-nome"
      >
        {vista.tappa.nome}
      </p>
      <div className="flex flex-wrap items-center justify-between gap-stack">
        <SceltaCategoriaTappa
          tappaId={vista.tappa.id}
          categoria={vista.categoria}
        />
        <nav aria-label="Altre pagine della tappa">
          <ul className="flex flex-wrap gap-x-space-4 gap-y-space-2">
            <li>
              <Link
                href={liveTappaHref(vista.tappa.id)}
                className="inline-flex min-h-12 items-center font-semibold underline decoration-2 underline-offset-4 focus-ring"
              >
                Live della tappa
              </Link>
            </li>
            <li>
              <Link
                href={tappaHref(vista.tappa.id)}
                className="inline-flex min-h-12 items-center font-semibold underline decoration-2 underline-offset-4 focus-ring"
              >
                Dettaglio della tappa
              </Link>
            </li>
          </ul>
        </nav>
      </div>
      <ClassificaTappaLive
        key={vista.standingsId}
        initial={vista.sync}
        tappaId={vista.tappa.id}
        categoria={vista.categoria}
        me={vista.me}
        mostraLaTuaTappa={vista.meCategoria === vista.categoria}
      />
    </div>
  );
}

/**
 * w-classifica-tappa (BLVS-49): the stage standing of one category, gold
 * final then silver, with the points per position, live.
 */
export default function ClassificaTappaPage({
  params,
  searchParams,
}: PageProps<"/tappe/[id]/classifica">) {
  return (
    <PageContainer
      title="Classifica di tappa"
      eyebrow="Tappe"
      description="Posizioni e punti delle finali gold e silver di questa tappa. Si aggiorna da sola."
    >
      <Suspense fallback={<LiveLoading what="della classifica di tappa" />}>
        {params.then(({ id }) => (
          <ClassificaTappaContent
            id={decodeURIComponent(id)}
            searchParams={searchParams}
          />
        ))}
      </Suspense>
    </PageContainer>
  );
}
