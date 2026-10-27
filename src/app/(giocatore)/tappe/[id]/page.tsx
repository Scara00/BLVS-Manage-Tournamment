import type { Metadata } from "next";
import { Suspense } from "react";
import { TappaDettaglioView, TappaLoading } from "@/components/tappa";
import { prendiPosto } from "@/lib/iscrizioni/actions";
import { readTappaDettaglio } from "@/lib/tappe/dettaglio-read";

export const metadata: Metadata = { title: "Dettaglio tappa" };

/**
 * Cache Components needs one sample to prerender the shell (AppShell reads
 * the pathname). Every other id renders on request inside Suspense. Drafts
 * and unknown ids never get here: the proxy rewrites them to a real 404
 * (`rewriteTappaNonTrovata`); `notFound()` in the read is a second line.
 */
export function generateStaticParams() {
  return [{ id: "rimini" }];
}

async function DettaglioContent({ id }: { id: string }) {
  const tappa = await readTappaDettaglio(id);
  return <TappaDettaglioView tappa={tappa} action={prendiPosto} />;
}

/** w-tappa: stage detail and «Prendi il posto N» (BLVS-24). */
export default function TappaPage({ params }: PageProps<"/tappe/[id]">) {
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-stack-lg px-inset py-space-6 md:px-inset-lg md:py-space-7">
      <Suspense fallback={<TappaLoading />}>
        {params.then(({ id }) => (
          <DettaglioContent id={decodeURIComponent(id)} />
        ))}
      </Suspense>
    </div>
  );
}
