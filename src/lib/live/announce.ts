import { partiteDaInserireLabel } from "@/lib/admin/tappe";
import type { LiveStatus } from "./client/live-connection";
import { formatLiveTime } from "./format";
import type { LiveEvent } from "./types";

/**
 * Short sentence read by the LiveAnnouncer for one event. It names what
 * changed, never the reordered rows.
 */
export function announcementFor(event: LiveEvent): string {
  switch (event.type) {
    case "score": {
      const last = event.match.sets.at(-1);
      const result = last ? ` ${last[0]}-${last[1]}` : "";
      return `${event.match.groupLabel}: nuovo risultato${result}`;
    }
    case "group-standings":
      return `Classifica ${event.group.label} aggiornata`;
    case "overall-standings":
      return "Classifica generale aggiornata";
    case "pending-scores":
      return `${event.stage.label}: ${partiteDaInserireLabel(event.stage.count)}`;
    case "phase-started": {
      const { label, matches } = event.phase;
      const partite = matches === 1 ? "1 partita" : `${matches} partite`;
      return `${label}: iniziati i gironi, ${partite} da giocare`;
    }
    case "board-matches":
      return `${event.board.label}: ${event.board.change ?? "partite aggiornate"}`;
  }
}

/**
 * Message for a connection change, or `null` when it is not worth saying
 * (first connection, retry after retry).
 */
export function statusAnnouncement(
  previous: LiveStatus | null,
  next: LiveStatus,
  freshAt: string,
): string | null {
  const down = (s: LiveStatus | null) =>
    s === "offline" || s === "reconnecting";
  if (previous === "live" && down(next)) {
    return `Connessione persa: dati non aggiornati dalle ${formatLiveTime(freshAt)}`;
  }
  if (down(previous) && next === "live") {
    return "Connessione ripristinata: dati aggiornati";
  }
  return null;
}
