"use client";

import { ArrowLeftIcon } from "lucide-react";
import Link from "next/link";
import { useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { useOnline } from "@/hooks/use-online";
import { descriviFiltri } from "@/lib/registro/filtri";
import { registroPath } from "@/lib/registro/paths";
import {
  annuncioPrecedenti,
  cursorePrecedenti,
  etichettaPrecedenti,
  unisciPagina,
} from "@/lib/registro/precedenti";
import { raggruppaPerGiorno } from "@/lib/registro/raggruppa";
import type {
  CaricaPrecedentiAction,
  RegistroTappaView,
} from "@/lib/registro/types";
import { RegistroFiltri } from "./registro-filtri";
import { RegistroGiorno } from "./registro-giorno";
import { RegistroOffline, RegistroVuoto } from "./registro-stati";

type RegistroTappaProps = {
  registro: RegistroTappaView;
  /** Server action, passed in by the page (a fake in Storybook). */
  caricaPrecedenti: CaricaPrecedentiAction;
  /** Overrides `navigator.onLine` (stories, tests). */
  online?: boolean;
  /** Link back to w-admin-tappa. */
  tappaHref?: string;
};

/**
 * w-admin-registro: the race log of a stage, read-only. Entries are
 * grouped by Rome day, newest first; older ones load on request. There is
 * no edit action: a correction is a new event written elsewhere.
 */
export function RegistroTappa({
  registro,
  caricaPrecedenti,
  online: forceOnline,
  tappaHref,
}: RegistroTappaProps) {
  const online = useOnline(forceOnline);
  const [pagina, setPagina] = useState(registro.pagina);
  const [annuncio, setAnnuncio] = useState("");
  const [errore, setErrore] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const statoRef = useRef<HTMLParagraphElement>(null);

  const giorni = raggruppaPerGiorno(pagina.voci, registro.oggi);
  const filtri = descriviFiltri(registro.filtri, registro.partite);
  const cursore = cursorePrecedenti(pagina);

  function caricaAltre() {
    if (cursore === null) return;
    setErrore(null);
    startTransition(async () => {
      const esito = await caricaPrecedenti(
        registro.tappa.id,
        registro.filtri,
        cursore,
      );
      if (esito.status !== "ok") {
        setErrore(esito.message);
        return;
      }
      const prima = pagina.voci.length;
      const unita = unisciPagina(pagina, esito.pagina);
      setPagina(unita);
      setAnnuncio(
        annuncioPrecedenti(unita.voci.length - prima, unita.restanti),
      );
      // The button is gone at the end of the log: keep focus on the news.
      if (unita.restanti === 0) {
        requestAnimationFrame(() => statoRef.current?.focus());
      }
    });
  }

  return (
    <div data-testid="registro-tappa" className="flex flex-col gap-stack">
      <div className="flex flex-col gap-space-2">
        <p className="font-heading text-lg font-semibold [overflow-wrap:anywhere]">
          {registro.tappa.nome}
        </p>
        <p className="text-muted-foreground">
          Sola consultazione: per correggere un punteggio usa
          l&apos;inserimento, che scrive una nuova voce.
        </p>
        {tappaHref ? (
          <Link
            href={tappaHref}
            className="inline-flex min-h-6 items-center gap-space-1 self-start font-heading font-semibold underline underline-offset-4"
          >
            <ArrowLeftIcon aria-hidden className="size-4" />
            Torna alla tappa
          </Link>
        ) : null}
      </div>

      <RegistroFiltri
        tappaId={registro.tappa.id}
        filtri={registro.filtri}
        partite={registro.partite}
      />

      <div role="status" className={online ? "contents" : undefined}>
        {online ? null : <RegistroOffline lettoAlle={registro.lettoAlle} />}
      </div>

      {pagina.voci.length === 0 ? (
        <RegistroVuoto
          filtri={filtri}
          azzeraHref={registroPath(registro.tappa.id)}
        />
      ) : (
        <>
          {filtri ? (
            <p className="[overflow-wrap:anywhere]">
              <span className="font-semibold">Filtri:</span> {filtri}
            </p>
          ) : null}
          {giorni.map((giorno) => (
            <RegistroGiorno key={giorno.giorno} giorno={giorno} />
          ))}
        </>
      )}

      <div className="flex flex-col items-start gap-space-3">
        <p
          ref={statoRef}
          role="status"
          tabIndex={-1}
          data-testid="registro-annuncio"
          className="focus-ring"
        >
          {errore ?? annuncio}
        </p>
        {cursore !== null ? (
          <Button
            type="button"
            variant="secondary"
            className="max-w-full"
            onClick={caricaAltre}
            loading={pending}
            disabled={!online}
          >
            {etichettaPrecedenti(pagina.restanti)}
          </Button>
        ) : null}
      </div>
    </div>
  );
}
