"use client";

import { useCallback } from "react";
import { LiveAnnouncer } from "@/components/live/live-announcer";
import { LiveBarConnected } from "@/components/live/live-bar";
import { LiveProvider } from "@/components/live/live-provider";
import type { Categoria } from "@/lib/db/types";
import type {
  LiveConnectionOptions,
  LiveStatus,
} from "@/lib/live/client/live-connection";
import type { LiveEvent, LiveSync } from "@/lib/live/types";
import {
  annuncioEventoTappa,
  eventoDellaClassificaTappa,
} from "@/lib/tappe/classifica/live";
import { classificaTappaSnapshotUrl } from "@/lib/tappe/paths";
import { ClassificaTappa } from "./classifica-tappa";

/**
 * w-classifica-tappa with its live channel: only this board's standing
 * and closing are folded in, so the Live bar's time moves with them. Each
 * new standing is announced once (one short sentence, focus untouched);
 * the closing event only removes «provvisori», it is not said twice.
 */
export function ClassificaTappaLive({
  initial,
  tappaId,
  categoria,
  me,
  mostraLaTuaTappa,
  connect = true,
  connection,
  initialStatus,
  reducedMotion,
}: {
  initial: LiveSync;
  tappaId: string;
  categoria: Categoria;
  me: string | null;
  mostraLaTuaTappa: boolean;
  connect?: boolean;
  /** Transport override (tests). */
  connection?: Partial<LiveConnectionOptions>;
  /** Status shown before the connection reports one (stories). */
  initialStatus?: LiveStatus;
  reducedMotion?: boolean;
}) {
  const standingsId = `${tappaId}:${categoria}`;
  const accept = useCallback(
    (event: LiveEvent) => eventoDellaClassificaTappa(event, standingsId),
    [standingsId],
  );
  const format = useCallback(
    (event: LiveEvent) => annuncioEventoTappa(event, me),
    [me],
  );
  return (
    <LiveProvider
      initial={initial}
      accept={accept}
      connect={connect}
      initialStatus={initialStatus}
      connection={{
        snapshotUrl: classificaTappaSnapshotUrl(tappaId, categoria),
        ...connection,
      }}
    >
      <div className="flex flex-col gap-stack">
        <LiveBarConnected />
        <LiveAnnouncer
          types={["stage-standings"]}
          filter={accept}
          format={format}
        />
        <ClassificaTappa
          standingsId={standingsId}
          categoria={categoria}
          me={me}
          mostraLaTuaTappa={mostraLaTuaTappa}
          reducedMotion={reducedMotion}
        />
      </div>
    </LiveProvider>
  );
}
