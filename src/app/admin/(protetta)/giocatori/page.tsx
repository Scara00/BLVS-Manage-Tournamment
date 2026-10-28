import type { Metadata } from "next";
import { Suspense } from "react";
import {
  GiocatoriAdmin,
  GiocatoriLoading,
  GiocatoriSessioneScaduta,
} from "@/components/admin-giocatori";
import { PageContainer } from "@/components/layout/page-container";
import {
  filtriHref,
  leggiFiltri,
  type FiltriGiocatori,
} from "@/lib/giocatori/admin/filtri";
import { readGiocatoriAdmin } from "@/lib/giocatori/admin/read";

export const metadata: Metadata = { title: "Giocatori · Amministrazione" };

async function GiocatoriContent({ filtri }: { filtri: FiltriGiocatori }) {
  const lettura = await readGiocatoriAdmin(filtri);
  if (lettura.status === "sessionExpired") {
    return <GiocatoriSessioneScaduta from={filtriHref(filtri)} />;
  }
  return <GiocatoriAdmin elenco={lettura.dati} filtri={filtri} />;
}

/** w-admin-giocatori. */
export default function AdminGiocatoriPage({
  searchParams,
}: PageProps<"/admin/giocatori">) {
  return (
    <PageContainer
      title="Giocatori"
      eyebrow="Amministrazione"
      description="Cerca un giocatore, controlla le categorie da verificare e apri la scheda per vedere iscrizioni e punti o cambiare la categoria."
    >
      <Suspense
        fallback={<GiocatoriLoading testo="Caricamento dei giocatori…" />}
      >
        {searchParams.then((query) => (
          <GiocatoriContent filtri={leggiFiltri(query)} />
        ))}
      </Suspense>
    </PageContainer>
  );
}
