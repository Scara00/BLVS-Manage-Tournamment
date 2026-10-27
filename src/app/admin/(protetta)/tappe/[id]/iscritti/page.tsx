import type { Metadata } from "next";
import { Suspense } from "react";
import { GestioneTappaLoading } from "@/components/admin-tappa";
import { IscrittiTappa } from "@/components/admin-iscritti";
import { TappaModificaSessioneScaduta } from "@/components/admin-tappa-modifica";
import { PageContainer } from "@/components/layout/page-container";
import {
  aggiungiIscritto,
  cercaGiocatori,
  rimuoviIscritto,
} from "@/lib/iscrizioni/admin/actions";
import { iscrittiPath } from "@/lib/iscrizioni/admin/paths";
import { readIscrittiTappa } from "@/lib/iscrizioni/admin/read";

export const metadata: Metadata = { title: "Iscritti · Amministrazione" };

/**
 * Cache Components needs one sample to prerender the shell (the admin
 * shell reads the pathname); every other id renders on request.
 */
export function generateStaticParams() {
  return [{ id: "rimini" }];
}

async function IscrittiContent({ id }: { id: string }) {
  const lettura = await readIscrittiTappa(id);
  if (lettura.status === "sessionExpired") {
    return <TappaModificaSessioneScaduta from={iscrittiPath(id)} />;
  }
  return (
    <IscrittiTappa
      tappa={lettura.tappa}
      aggiungi={aggiungiIscritto}
      rimuovi={rimuoviIscritto}
      cerca={cercaGiocatori}
    />
  );
}

/** w-admin-iscritti. */
export default function IscrittiTappaPage({
  params,
}: PageProps<"/admin/tappe/[id]/iscritti">) {
  return (
    <PageContainer
      title="Iscritti"
      eyebrow="Amministrazione · Tappe"
      description="Gli iscritti di ogni tabellone con posto e data. Aggiungi un giocatore registrato anche a iscrizioni chiuse, rimuovi un iscritto o esporta l'elenco in CSV."
    >
      <Suspense
        fallback={<GestioneTappaLoading testo="Caricamento degli iscritti…" />}
      >
        {params.then(({ id }) => (
          <IscrittiContent id={decodeURIComponent(id)} />
        ))}
      </Suspense>
    </PageContainer>
  );
}
