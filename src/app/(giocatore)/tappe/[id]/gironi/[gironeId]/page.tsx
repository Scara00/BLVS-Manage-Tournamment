import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { LiveGirone } from "@/components/girone";
import { PageContainer } from "@/components/layout/page-container";
import { LiveLoading, LiveTappaSessioneScaduta } from "@/components/live";
import { FASE_GIRONE_LABEL } from "@/lib/gironi/fasi/fase";
import { readLiveGirone } from "@/lib/live/girone-read";
import { gironeTappaHref, liveTappaHref } from "@/lib/tappe/paths";

export const metadata: Metadata = { title: "Girone" };

/**
 * Cache Components needs one sample to prerender the shell. Other ids
 * render on request; drafts and unknown stages are a real 404 from the
 * proxy (`rewriteTappaNonTrovata`), unknown groups from `notFound()`.
 */
export function generateStaticParams() {
  return [{ id: "jesolo", gironeId: "jesolo-M-g1" }];
}

function TornaAlLive({ tappaId }: { tappaId: string }) {
  return (
    <p>
      <Link
        href={liveTappaHref(tappaId)}
        className="font-semibold underline decoration-2 underline-offset-4"
      >
        Torna al live della tappa
      </Link>
    </p>
  );
}

async function GironeContent({
  tappaId,
  gironeId,
}: {
  tappaId: string;
  gironeId: string;
}) {
  const live = await readLiveGirone(tappaId, gironeId);
  if (live.status === "notFound") notFound();
  if (live.status === "sessionExpired") {
    return (
      <PageContainer title="Girone" eyebrow={live.tappa.nome}>
        <LiveTappaSessioneScaduta
          tappaId={live.tappa.id}
          ritorno={gironeTappaHref(tappaId, gironeId)}
        />
      </PageContainer>
    );
  }
  const { girone } = live;
  return (
    <PageContainer
      title={girone.nome}
      eyebrow={live.tappa.nome}
      description={`${FASE_GIRONE_LABEL[girone.fase]} · ${
        girone.categoria === "M" ? "maschile" : "femminile"
      }. Risultati e classifica si aggiornano da soli.`}
    >
      <div className="flex flex-col gap-stack-lg">
        <TornaAlLive tappaId={live.tappa.id} />
        <LiveGirone
          tappaId={live.tappa.id}
          girone={girone}
          initial={live.sync}
          me={live.me}
        />
      </div>
    </PageContainer>
  );
}

/** w-girone (BLVS-47): one group of a stage, live. */
export default function GironeTappaPage({
  params,
}: PageProps<"/tappe/[id]/gironi/[gironeId]">) {
  return (
    <Suspense
      fallback={
        <PageContainer title="Girone" eyebrow="Tappe">
          <LiveLoading what="del girone" />
        </PageContainer>
      }
    >
      {params.then(({ id, gironeId }) => (
        <GironeContent
          tappaId={decodeURIComponent(id)}
          gironeId={decodeURIComponent(gironeId)}
        />
      ))}
    </Suspense>
  );
}
