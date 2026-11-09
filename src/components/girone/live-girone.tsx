"use client";

import { CLASSIFICA_CATEGORIA, righePerCategoria } from "@/lib/tappe/formato";
import { useCallback } from "react";
import { LiveAnnouncer } from "@/components/live/live-announcer";
import { LiveBarConnected } from "@/components/live/live-bar";
import { LiveProvider, useLive } from "@/components/live/live-provider";
import { PhaseBadge } from "@/components/scoreboard";
import { coloreGirone } from "@/lib/gironi/fasi/fase";
import {
  annuncioGirone,
  eventoDelGirone,
  lineaDiTaglio,
  vistaGirone,
  type GironeInfo,
} from "@/lib/live/girone";
import type {
  LiveConnectionOptions,
  LiveStatus,
} from "@/lib/live/client/live-connection";
import {
  chiaveParziale,
  chiaveRisultato,
  INTERVALLO_ANNUNCI_PARZIALE_MS,
} from "@/lib/live/limita-annunci";
import type { LiveMe } from "@/lib/live/tappa";
import type { LiveEvent, LiveSync } from "@/lib/live/types";
import { liveTappaSnapshotUrl } from "@/lib/tappe/paths";
import { ClassificaGirone } from "./classifica-girone";
import { CriteriSpareggio } from "./criteri-spareggio";
import { PartitaInEvidenza, PartiteGirone } from "./partite-girone";

export type LiveGironeProps = {
  tappaId: string;
  girone: GironeInfo;
  initial: LiveSync;
  /** Registration id of the player; null for a spectator. */
  me: LiveMe;
  /** `false` renders the snapshot only (stories). */
  connect?: boolean;
  initialStatus?: LiveStatus;
  /** Overrides the transport (tests). */
  connection?: Partial<LiveConnectionOptions>;
  /** Forces reduced motion (stories, tests). */
  reducedMotion?: boolean;
  intervalloAnnunciParzialeMs?: number;
};

/**
 * w-girone (BLVS-47): one group of a stage, live. The match in progress,
 * the full standing with its cut line, then the other matches. ONE polite
 * announcer says each result once; the reordered rows are never read and
 * focus never moves.
 */
export function LiveGirone({
  tappaId,
  girone,
  initial,
  me,
  connect = true,
  initialStatus,
  connection,
  reducedMotion,
  intervalloAnnunciParzialeMs = INTERVALLO_ANNUNCI_PARZIALE_MS,
}: LiveGironeProps) {
  const accept = useCallback(
    (event: LiveEvent) => eventoDelGirone(event, tappaId, girone.id),
    [tappaId, girone.id],
  );
  const format = useCallback(
    (event: LiveEvent) => annuncioGirone(event, me),
    [me],
  );
  return (
    <LiveProvider
      initial={initial}
      connect={connect}
      initialStatus={initialStatus}
      accept={accept}
      connection={{ snapshotUrl: liveTappaSnapshotUrl(tappaId), ...connection }}
    >
      <div className="flex flex-col gap-stack-lg" data-testid="live-girone">
        <LiveBarConnected />
        <LiveAnnouncer
          types={["score"]}
          filter={accept}
          format={format}
          limita={{
            chiave: chiaveParziale,
            libera: chiaveRisultato,
            intervalloMs: intervalloAnnunciParzialeMs,
          }}
        />
        <LiveGironeBody girone={girone} me={me} reducedMotion={reducedMotion} />
      </div>
    </LiveProvider>
  );
}

function LiveGironeBody({
  girone,
  me,
  reducedMotion,
}: {
  girone: GironeInfo;
  me: LiveMe;
  reducedMotion?: boolean;
}) {
  const { snapshot } = useLive();
  const vista = vistaGirone(snapshot, girone.id);
  const rows = vista.standing?.rows ?? [];
  const colore = coloreGirone(girone.fase);
  return (
    <>
      <section
        aria-labelledby="girone-in-corso-titolo"
        className="flex flex-col gap-stack"
      >
        <h2
          id="girone-in-corso-titolo"
          className="font-heading text-xl font-semibold"
        >
          In campo adesso
        </h2>
        {vista.inCorso.length === 0 ? (
          <PartitaInEvidenza
            match={null}
            me={me}
            reducedMotion={reducedMotion}
          />
        ) : (
          vista.inCorso.map((match) => (
            <PartitaInEvidenza
              key={match.id}
              match={match}
              me={me}
              reducedMotion={reducedMotion}
            />
          ))
        )}
      </section>

      <section
        aria-labelledby="girone-classifica-titolo"
        className="flex flex-col gap-stack"
      >
        <div className="flex flex-wrap items-center gap-space-3">
          <h2
            id="girone-classifica-titolo"
            className="font-heading text-xl font-semibold"
          >
            Classifica
          </h2>
          {colore ? <PhaseBadge phase={colore} /> : null}
        </div>
        {righePerCategoria(rows).map(({ categoria, rows: delGruppo }) =>
          categoria ? (
            // Mixed board: men and women ranked apart, each with its line.
            <div key={categoria} className="flex flex-col gap-stack-sm">
              <h3 className="font-heading text-lg font-semibold">
                {CLASSIFICA_CATEGORIA[categoria]}
              </h3>
              <ClassificaGirone
                label={`${girone.nome} · ${CLASSIFICA_CATEGORIA[categoria].toLowerCase()}`}
                rows={delGruppo}
                linea={lineaDiTaglio(girone, delGruppo)}
                me={me}
                reducedMotion={reducedMotion}
              />
            </div>
          ) : (
            <ClassificaGirone
              key="tutti"
              label={girone.nome}
              rows={delGruppo}
              linea={lineaDiTaglio(girone, delGruppo)}
              me={me}
              reducedMotion={reducedMotion}
            />
          ),
        )}
      </section>

      <section
        aria-labelledby="girone-partite-titolo"
        className="flex flex-col gap-stack"
      >
        <h2
          id="girone-partite-titolo"
          className="font-heading text-xl font-semibold"
        >
          Partite del girone
        </h2>
        <PartiteGirone
          matches={vista.altre}
          me={me}
          reducedMotion={reducedMotion}
        />
      </section>

      <CriteriSpareggio />
    </>
  );
}
