import type { Metadata } from "next";
import { Suspense } from "react";
import { RegistroLoading, RegistroTappa } from "@/components/admin-registro";
import { TappaModificaSessioneScaduta } from "@/components/admin-tappa-modifica";
import { PageContainer } from "@/components/layout/page-container";
import { caricaVociPrecedenti } from "@/lib/registro/actions";
import { filtriQuery, parseFiltri } from "@/lib/registro/filtri";
import { registroPath } from "@/lib/registro/paths";
import { readRegistroTappa } from "@/lib/registro/read";
import type { FiltriRegistro } from "@/lib/registro/types";
import { gestioneTappaPath } from "@/lib/tappe/gestione-state";

export const metadata: Metadata = {
  title: "Registro dei punteggi · Amministrazione",
};

/**
 * Cache Components needs one sample to prerender the shell (the admin
 * shell reads the pathname); every other id renders on request.
 */
export function generateStaticParams() {
  return [{ id: "jesolo" }];
}

async function RegistroContent({
  id,
  filtri,
}: {
  id: string;
  filtri: FiltriRegistro;
}) {
  const lettura = await readRegistroTappa(id, filtri);
  if (lettura.status === "sessionExpired") {
    return <TappaModificaSessioneScaduta from={registroPath(id, filtri)} />;
  }
  return (
    <RegistroTappa
      // New filters = a new first page: start over, older entries dropped.
      key={filtriQuery(filtri)}
      registro={lettura.registro}
      caricaPrecedenti={caricaVociPrecedenti}
      tappaHref={gestioneTappaPath(id)}
    />
  );
}

/** w-admin-registro. */
export default function RegistroTappaPage({
  params,
  searchParams,
}: PageProps<"/admin/tappe/[id]/registro">) {
  return (
    <PageContainer
      title="Registro dei punteggi"
      eyebrow="Amministrazione · Tappe"
      description="Ogni inserimento, correzione e annullamento dei punteggi, con ritiri, parità risolte, rigenerazioni e cambi di categoria: chi, quando, prima e dopo. Le voci non si modificano."
    >
      <Suspense fallback={<RegistroLoading />}>
        {Promise.all([params, searchParams]).then(([{ id }, query]) => (
          <RegistroContent
            id={decodeURIComponent(id)}
            filtri={parseFiltri(query)}
          />
        ))}
      </Suspense>
    </PageContainer>
  );
}
