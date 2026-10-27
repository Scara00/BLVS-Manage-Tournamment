import type { Metadata } from "next";
import { Suspense } from "react";
import { IscrizioneConfermataView, TappaLoading } from "@/components/tappa";
import { readIscrizioneConfermata } from "@/lib/tappe/dettaglio-read";

export const metadata: Metadata = { title: "Iscrizione confermata" };

export function generateStaticParams() {
  return [{ id: "rimini" }];
}

async function ConfermaContent({ id }: { id: string }) {
  const iscrizione = await readIscrizioneConfermata(id);
  return <IscrizioneConfermataView iscrizione={iscrizione} />;
}

/** w-iscrizione-ok: the seat just taken, with date, place and deadlines. */
export default function IscrizionePage({
  params,
}: PageProps<"/tappe/[id]/iscrizione">) {
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-stack-lg px-inset py-space-6 md:px-inset-lg md:py-space-7">
      <Suspense fallback={<TappaLoading what="dell'iscrizione" />}>
        {params.then(({ id }) => (
          <ConfermaContent id={decodeURIComponent(id)} />
        ))}
      </Suspense>
    </div>
  );
}
