"use client";

import { useCallback } from "react";
import { standingsDi } from "@/components/classifica-generale/classifica-generale-live";
import { LiveAnnouncer } from "@/components/live/live-announcer";
import { LiveBarConnected } from "@/components/live/live-bar";
import { LiveProvider } from "@/components/live/live-provider";
import { annuncioScheda } from "@/lib/classifica-generale/giocatore";
import type { Categoria } from "@/lib/db/types";
import type {
  LiveConnectionOptions,
  LiveStatus,
} from "@/lib/live/client/live-connection";
import type { LiveEvent, LiveSync } from "@/lib/live/types";
import { SchedaGiocatore } from "./scheda-giocatore";

/**
 * w-giocatore with its live channel: the same overall-standings events as
 * w-classifica, so points and «provvisori» change without a reload. Each
 * update is said once, about this player only.
 */
export function SchedaGiocatoreLive({
  initial,
  standingsId,
  utenteId,
  categoria,
  stagione,
  me,
  connect = true,
  connection,
  initialStatus,
  reducedMotion,
}: {
  initial: LiveSync;
  standingsId: string;
  utenteId: string;
  categoria: Categoria;
  stagione: number;
  me: string | null;
  connect?: boolean;
  /** Transport override (tests). */
  connection?: Partial<LiveConnectionOptions>;
  /** Status shown before the connection reports one (stories). */
  initialStatus?: LiveStatus;
  reducedMotion?: boolean;
}) {
  const accept = useCallback(
    (event: LiveEvent) => standingsDi(event, standingsId),
    [standingsId],
  );
  const format = useCallback(
    (event: LiveEvent) => annuncioScheda(event, utenteId),
    [utenteId],
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
        <SchedaGiocatore
          standingsId={standingsId}
          utenteId={utenteId}
          categoria={categoria}
          stagione={stagione}
          me={me}
          reducedMotion={reducedMotion}
        />
      </div>
    </LiveProvider>
  );
}
