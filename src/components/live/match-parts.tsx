import type { LiveMe } from "@/lib/live/tappa";
import type { LiveMatch, LivePlayer } from "@/lib/live/types";

/*
 * Pieces of a match shared by w-live and w-girone: the state as text, the
 * score as read by screen readers and the full team names.
 */

export const STATO_PARTITA: Record<NonNullable<LiveMatch["state"]>, string> = {
  programmata: "Da giocare",
  in_corso: "Live",
  conclusa: "Finita",
  annullata: "Annullata",
};

export function setsLabel(match: LiveMatch) {
  if (match.sets.length === 0) return "nessun punto ancora";
  return match.sets
    .map(([home, away], i) => `set ${i + 1} ${home} a ${away}`)
    .join(", ");
}

export function teamName(
  players: readonly LivePlayer[] | undefined,
  fallback: string,
) {
  return players && players.length > 0
    ? players.map((p) => p.name).join(" e ")
    : fallback;
}

/** Full names of a team, «(tu)» after the player looking at the page. */
export function Team({
  players,
  fallback,
  me,
}: {
  players: readonly LivePlayer[] | undefined;
  fallback: string;
  me: LiveMe;
}) {
  if (!players || players.length === 0) return <>{fallback}</>;
  return (
    <>
      {players.map((p, i) => (
        <span key={p.id}>
          {i > 0 ? <span className="font-normal"> e </span> : null}
          {p.name}
          {p.id === me ? <span className="font-normal"> (tu)</span> : null}
        </span>
      ))}
    </>
  );
}
