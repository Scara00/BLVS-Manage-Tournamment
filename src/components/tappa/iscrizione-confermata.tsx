"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";
import { ActionLink } from "@/components/error-page/action-link";
import { ScoreboardRows } from "@/components/error-page/scoreboard-rows";
import { Tape } from "@/components/scoreboard";
import {
  CATEGORIA_LABEL,
  nelTabellone,
  type IscrizioneConfermata,
} from "@/lib/tappe/dettaglio";
import { TAPPE_PATH, tappaHref } from "@/lib/tappe/paths";

const subscribe = () => () => {};

/**
 * w-iscrizione-ok: seat, date, place, meeting point and the deadline to
 * cancel, as a mini scoreboard. Focus goes to the title on arrival, and a
 * polite status region (empty in the server HTML, filled once mounted)
 * announces the confirmation.
 */
export function IscrizioneConfermataView({
  iscrizione,
}: {
  iscrizione: IscrizioneConfermata;
}) {
  const titleRef = useRef<HTMLHeadingElement>(null);
  const mounted = useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );

  useEffect(() => {
    const title = titleRef.current;
    if (!title) return;
    // focus() ignores scroll-padding-top in Chromium: scroll separately.
    title.focus({ preventScroll: true });
    title.scrollIntoView?.({ block: "nearest" });
  }, []);

  const posto = iscrizione.posto
    ? `posto ${iscrizione.posto} ${nelTabellone(iscrizione.categoria)}`
    : `un posto ${nelTabellone(iscrizione.categoria)}`;
  const annuncio = `Iscrizione confermata: ${posto}, ${iscrizione.nome}.`;

  const rows = [
    {
      label: "Posto",
      value: iscrizione.posto
        ? `${iscrizione.posto} · ${CATEGORIA_LABEL[iscrizione.categoria]}`
        : CATEGORIA_LABEL[iscrizione.categoria],
      tone: "tape" as const,
    },
    { label: "Data", value: iscrizione.periodo },
    { label: "Luogo", value: iscrizione.luogo },
    {
      label: "Ritrovo",
      value: iscrizione.ritrovo
        ? `${iscrizione.ritrovo}${iscrizione.ritrovoAlle ? `, ${iscrizione.ritrovoAlle}` : ""}`
        : "Comunicato a breve",
    },
    {
      label: "Annulla entro",
      value:
        iscrizione.annullaEntro && iscrizione.annullaEntroIso ? (
          <time dateTime={iscrizione.annullaEntroIso}>
            {iscrizione.annullaEntro}
          </time>
        ) : (
          "Nessuna scadenza"
        ),
    },
  ];

  return (
    <section
      aria-labelledby="iscrizione-ok-titolo"
      data-testid="iscrizione-confermata"
      className="flex max-w-3xl flex-col gap-stack-lg"
    >
      <p role="status" className="sr-only" data-testid="annuncio-iscrizione">
        {mounted ? annuncio : ""}
      </p>
      <header className="flex flex-col gap-space-3">
        <Tape size={8} className="w-24" />
        <p className="text-sm font-medium tracking-wide text-muted-foreground uppercase">
          {iscrizione.nome}
        </p>
        <h1
          id="iscrizione-ok-titolo"
          ref={titleRef}
          tabIndex={-1}
          className="font-heading text-3xl font-semibold tracking-tight text-balance focus-ring md:text-4xl"
        >
          Sei iscritto: {posto}
        </h1>
        <p className="max-w-prose text-lg">
          Ti aspettiamo al ritrovo. Se non puoi partecipare, annulla entro la
          scadenza per liberare il posto.
        </p>
      </header>
      <ScoreboardRows rows={rows} label="Riepilogo dell'iscrizione" />
      <div className="flex flex-wrap gap-space-3">
        <ActionLink href={tappaHref(iscrizione.tappaId)} variant="primary">
          Torna alla tappa
        </ActionLink>
        <ActionLink href={TAPPE_PATH}>Tutte le tappe</ActionLink>
      </div>
    </section>
  );
}
