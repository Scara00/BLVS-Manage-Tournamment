"use client";

import Link from "next/link";
import { useCallback, useRef } from "react";
import {
  LiveAnnouncer,
  LiveBarConnected,
  LiveProvider,
  MatchCard,
  MioGirone,
  useLive,
} from "@/components/live";
import { PuntiProvvisori } from "@/components/classifica-generale/riga-giocatore";
import { useLiveRowMotion } from "@/components/live/use-live-row-motion";
import { buttonVariants } from "@/components/ui/button";
import type { HomeGara as HomeGaraData } from "@/lib/home/types";
import { posizioneNelGirone } from "@/lib/home/vista";
import type {
  LiveConnectionOptions,
  LiveStatus,
} from "@/lib/live/client/live-connection";
import {
  chiaveParziale,
  chiaveRisultato,
  INTERVALLO_ANNUNCI_PARZIALE_MS,
} from "@/lib/live/limita-annunci";
import {
  annuncioPartita,
  eventoDellaTappa,
  vistaLive,
  type FasiTabelloni,
  type LiveMe,
} from "@/lib/live/tappa";
import type { LiveEvent, LiveMatch, OverallPlayerRow } from "@/lib/live/types";
import { CLASSIFICA_PATH } from "@/lib/navigation/auth-paths";
import {
  classificaTappaHref,
  liveTappaHref,
  liveTappaSnapshotUrl,
} from "@/lib/tappe/paths";
import { HomeHeader } from "./home-header";

export type HomeGaraProps = {
  saluto: string;
  dati: HomeGaraData;
  /** `false` renders the snapshot only (stories). */
  connect?: boolean;
  initialStatus?: LiveStatus;
  /** Overrides the transport (tests). */
  connection?: Partial<LiveConnectionOptions>;
  /**
   * Overrides `prefers-reduced-motion` (stories, tests): no pulse on the
   * bar and no split-flap «palette» on the partial score.
   */
  reducedMotion?: boolean;
};

/**
 * w-home on the race day (BLVS-52): the compact Live bar beside the
 * greeting, then my match, my place (group and overall) and my group with
 * the «Tu» row. It reads the same stage-scoped live data as w-live
 * (BLVS-36), so scores and standings update in place; one polite
 * announcer speaks my results.
 */
export function HomeGara({
  saluto,
  dati,
  connect = true,
  initialStatus,
  connection,
  reducedMotion,
}: HomeGaraProps) {
  const tappaId = dati.tappa.id;
  const accept = useCallback(
    (event: LiveEvent) => eventoDellaTappa(event, tappaId),
    [tappaId],
  );
  const format = useCallback(
    (event: LiveEvent) => annuncioPartita(event, dati.me),
    [dati.me],
  );
  return (
    <LiveProvider
      initial={dati.sync}
      connect={connect}
      initialStatus={initialStatus}
      accept={accept}
      connection={{ snapshotUrl: liveTappaSnapshotUrl(tappaId), ...connection }}
    >
      <div className="flex flex-col gap-stack-lg" data-testid="home-gara">
        <HomeHeader saluto={saluto}>
          <LiveBarConnected compact reducedMotion={reducedMotion} />
        </HomeHeader>
        <LiveAnnouncer
          types={["score", "group-standings", "phase-started", "board-closed"]}
          filter={accept}
          format={format}
          limita={{
            chiave: chiaveParziale,
            libera: chiaveRisultato,
            intervalloMs: INTERVALLO_ANNUNCI_PARZIALE_MS,
          }}
        />
        <div className="flex flex-wrap items-center gap-x-space-4 gap-y-space-2">
          <p className="font-heading text-lg font-semibold [overflow-wrap:anywhere]">
            Oggi si gioca: {dati.tappa.nome}
          </p>
          <Link
            href={liveTappaHref(tappaId)}
            className={buttonVariants({
              variant: "primary",
              className: "max-w-full",
            })}
          >
            Segui il live
          </Link>
        </div>
        <HomeGaraBody
          tappaId={tappaId}
          me={dati.me}
          fasi={dati.fasi}
          generale={dati.generale}
          categoria={dati.categoria}
          reducedMotion={reducedMotion}
        />
      </div>
    </LiveProvider>
  );
}

function HomeGaraBody({
  tappaId,
  me,
  fasi,
  generale,
  categoria,
  reducedMotion,
}: {
  tappaId: string;
  me: LiveMe;
  fasi: FasiTabelloni;
  generale: OverallPlayerRow | null;
  categoria: HomeGaraData["categoria"];
  reducedMotion?: boolean;
}) {
  const { snapshot } = useLive();
  const vista = vistaLive(snapshot, me);
  const daGiocare = vista.mie.find(
    (m) => (m.state ?? "in_corso") === "in_corso" || m.state === "programmata",
  );
  const ultima = vista.mie.filter((m) => m.state === "conclusa").at(-1);
  const partita = daGiocare ?? ultima ?? null;

  return (
    <>
      <section
        aria-labelledby="home-partita-titolo"
        className="flex flex-col gap-stack"
      >
        <h2
          id="home-partita-titolo"
          className="font-heading text-xl font-semibold"
        >
          {daGiocare || !ultima ? "La tua partita" : "La tua ultima partita"}
        </h2>
        {partita ? (
          <MiaPartita
            match={partita}
            me={me}
            fasi={fasi}
            reducedMotion={reducedMotion}
          />
        ) : (
          <p className="border border-border p-inset">
            Non hai ancora partite in questa tappa: compariranno qui appena
            l&apos;organizzazione avvia i gironi.
          </p>
        )}
        {!daGiocare && ultima ? (
          <p>Hai giocato tutte le tue partite del girone.</p>
        ) : null}
      </section>

      <LaTuaPosizioneOggi
        girone={vista.mioGirone}
        me={me}
        generale={generale}
        categoria={categoria}
        tappaId={tappaId}
      />

      {vista.mioGirone ? (
        <MioGirone
          tappaId={tappaId}
          group={vista.mioGirone}
          me={me}
          fase={vista.mioGirone.category && fasi[vista.mioGirone.category]}
        />
      ) : null}
    </>
  );
}

function MiaPartita({
  match,
  me,
  fasi,
  reducedMotion,
}: {
  match: LiveMatch;
  me: LiveMe;
  fasi: FasiTabelloni;
  reducedMotion?: boolean;
}) {
  const ref = useRef<HTMLUListElement>(null);
  useLiveRowMotion(ref);
  return (
    <ul ref={ref} data-testid="home-mia-partita" className="grid max-w-2xl">
      <MatchCard
        match={match}
        me={me}
        fase={match.category && fasi[match.category]}
        mine
        reducedMotion={reducedMotion}
      />
    </ul>
  );
}

function LaTuaPosizioneOggi({
  girone,
  me,
  generale,
  categoria,
  tappaId,
}: {
  girone: ReturnType<typeof vistaLive>["mioGirone"];
  me: LiveMe;
  generale: OverallPlayerRow | null;
  categoria: HomeGaraData["categoria"];
  tappaId: string;
}) {
  const nelGirone = girone ? posizioneNelGirone(girone.rows, me) : null;
  return (
    <section
      aria-labelledby="home-posizione-titolo"
      data-testid="home-posizione"
      className="flex flex-col gap-space-3 border-2 border-primary p-inset"
    >
      <h2
        id="home-posizione-titolo"
        className="font-heading text-xl font-semibold"
      >
        La tua posizione
      </h2>
      <dl className="flex flex-wrap gap-x-space-7 gap-y-space-4">
        <div
          className="flex flex-col gap-space-1"
          data-testid="home-posizione-girone"
        >
          <dt className="text-sm text-foreground">
            Nel girone{girone ? ` · ${girone.label}` : ""}
          </dt>
          <dd className="flex flex-wrap items-baseline gap-space-2">
            {nelGirone ? (
              <>
                <span className="font-mono text-3xl font-semibold tabular-nums">
                  {nelGirone.position}ª
                </span>{" "}
                {nelGirone.tied ? <span>pari merito</span> : null}
              </>
            ) : (
              <span>Non ancora in classifica</span>
            )}
          </dd>
        </div>
        <div
          className="flex flex-col gap-space-1"
          data-testid="home-posizione-generale"
        >
          <dt className="text-sm text-foreground">
            In classifica generale{categoria ? ` · ${categoria}` : ""}
          </dt>
          <dd className="flex flex-wrap items-baseline gap-space-2">
            {generale ? (
              <>
                <span className="font-mono text-3xl font-semibold tabular-nums">
                  {generale.position}ª
                </span>{" "}
                {generale.tied ? <span>pari merito </span> : null}
                <span>
                  <span className="font-mono tabular-nums">
                    {generale.points}
                  </span>{" "}
                  {generale.points === 1 ? "punto" : "punti"}
                </span>{" "}
                {generale.provisional ? <PuntiProvvisori /> : null}
              </>
            ) : (
              <span>Non ancora in classifica</span>
            )}
          </dd>
        </div>
      </dl>
      <p className="flex flex-wrap gap-x-space-5 gap-y-space-2">
        <Link
          href={classificaTappaHref(tappaId)}
          className="font-heading font-semibold underline decoration-2 underline-offset-4 focus-ring hover:decoration-4"
        >
          Classifica di tappa
        </Link>
        <Link
          href={CLASSIFICA_PATH}
          className="font-heading font-semibold underline decoration-2 underline-offset-4 focus-ring hover:decoration-4"
        >
          Classifica generale
        </Link>
      </p>
    </section>
  );
}
