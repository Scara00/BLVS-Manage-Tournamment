import type { Metadata } from "next";
import { Suspense } from "react";
import {
  GiocatoriLoading,
  GiocatoriSessioneScaduta,
  SchedaGiocatoreAdmin,
} from "@/components/admin-giocatori";
import { PageContainer } from "@/components/layout/page-container";
import {
  cambiaCategoria,
  verificaCategoria,
} from "@/lib/giocatori/admin/actions";
import { giocatoreAdminPath } from "@/lib/giocatori/admin/paths";
import { readSchedaGiocatoreAdmin } from "@/lib/giocatori/admin/read";

// Never a personal name in the <title>.
export const metadata: Metadata = {
  title: "Scheda del giocatore · Amministrazione",
};

/**
 * Cache Components needs one sample to prerender the shell (the admin
 * shell reads the pathname); every other id renders on request.
 */
export function generateStaticParams() {
  return [{ id: "demo-u-m-01" }];
}

async function SchedaContent({ id }: { id: string }) {
  const lettura = await readSchedaGiocatoreAdmin(id);
  if (lettura.status === "sessionExpired") {
    return <GiocatoriSessioneScaduta from={giocatoreAdminPath(id)} />;
  }
  return (
    <SchedaGiocatoreAdmin
      scheda={lettura.dati}
      cambia={cambiaCategoria}
      verifica={verificaCategoria}
    />
  );
}

/** w-admin-giocatore. */
export default function AdminGiocatorePage({
  params,
}: PageProps<"/admin/giocatori/[id]">) {
  return (
    <PageContainer
      title="Scheda del giocatore"
      eyebrow="Amministrazione · Giocatori"
      description="Dati, iscrizioni e punti del giocatore. Da qui verifichi o cambi la categoria."
    >
      <Suspense
        fallback={<GiocatoriLoading testo="Caricamento della scheda…" />}
      >
        {params.then(({ id }) => (
          <SchedaContent id={decodeURIComponent(id)} />
        ))}
      </Suspense>
    </PageContainer>
  );
}
