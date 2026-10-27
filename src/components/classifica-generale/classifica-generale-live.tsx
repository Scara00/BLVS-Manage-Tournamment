"use client";

import { useCallback } from "react";
import { LiveAnnouncer } from "@/components/live/live-announcer";
import { LiveBarConnected } from "@/components/live/live-bar";
import { LiveProvider } from "@/components/live/live-provider";
import { annuncioEvento } from "@/lib/classifica-generale/annuncio";
import type { Categoria } from "@/lib/db/types";
import type {
  LiveConnectionOptions,
  LiveStatus,
} from "@/lib/live/client/live-connection";
import type { LiveEvent, LiveSync } from "@/lib/live/types";
import { ClassificaGenerale } from "./classifica-generale";

export function standingsDi(event: LiveEvent, id: string): boolean {
  return event.type === "overall-standings" && event.standings?.id === id;
}

/**
 * w-classifica with its live channel: only this standing's events are
 * folded in, so the Live bar's time moves with them, and each update is
 * announced once (one short sentence, focus untouched).
 */
export function ClassificaGeneraleLive({
  initial,
  standingsId,
  categoria,
  stagione,
  me,
  connect = true,
  connection,
  initialStatus,
}: {
  initial: LiveSync;
  standingsId: string;
  categoria: Categoria;
  stagione: number | null;
  me: string | null;
  connect?: boolean;
  /** Transport override (tests). */
  connection?: Partial<LiveConnectionOptions>;
  /** Status shown before the connection reports one (stories). */
  initialStatus?: LiveStatus;
}) {
  const accept = useCallback(
    (event: LiveEvent) => standingsDi(event, standingsId),
    [standingsId],
  );
  const format = useCallback(
    (event: LiveEvent) => annuncioEvento(event, me),
    [me],
  );
  return (
    <LiveProvider
      initial={initial}
      accept={accept}
      connect={connect}
      initialStatus={initialStatus}
      connection={{
        snapshotUrl: `/api/live/snapshot?classifica=${encodeURIComponent(standingsId)}`,
        ...connection,
      }}
    >
      <div className="flex flex-col gap-stack">
        <LiveBarConnected />
        <LiveAnnouncer
          types={["overall-standings"]}
          filter={accept}
          format={format}
        />
        <ClassificaGenerale
          standingsId={standingsId}
          categoria={categoria}
          stagione={stagione}
          me={me}
        />
      </div>
    </LiveProvider>
  );
}
