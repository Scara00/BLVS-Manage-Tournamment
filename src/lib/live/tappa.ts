import type { Categoria, FaseTabellone } from "@/lib/db/types";
import { announcementFor } from "./announce";
import type {
  GroupStandings,
  LiveEvent,
  LiveMatch,
  LiveSnapshot,
} from "./types";

/*
 * The player live screen of a stage (w-live, BLVS-36): which matches are
 * the player's own, their group, and what is on court right now. Pure, so
 * the ordering and the highlight are unit-tested without React.
 */

/** Registration id of the player looking at the page; null = spectator. */
export type LiveMe = string | null;

/** Gold/Silver of each board; missing until the admin sets it. */
export type FasiTabelloni = Partial<Record<Categoria, FaseTabellone>>;

export type VistaLive = {
  /** The player's own matches: in progress, then to play, then played. */
  mie: LiveMatch[];
  /** The group the player is in, if its standing is known. */
  mioGirone: GroupStandings | null;
  /** Other groups' matches on court now, court by court. */
  inCampo: LiveMatch[];
};

const courts = new Intl.Collator("it", { numeric: true, sensitivity: "base" });

/** True when `me` plays in the match (either team). */
export function isMiaPartita(match: LiveMatch, me: LiveMe): boolean {
  if (!me || !match.players) return false;
  return [...match.players.home, ...match.players.away].some(
    (p) => p.id === me,
  );
}

/** The team of `me` in the match, or null. */
export function mioLato(match: LiveMatch, me: LiveMe): "home" | "away" | null {
  if (!me || !match.players) return null;
  if (match.players.home.some((p) => p.id === me)) return "home";
  if (match.players.away.some((p) => p.id === me)) return "away";
  return null;
}

const STATE_ORDER: Record<NonNullable<LiveMatch["state"]>, number> = {
  in_corso: 0,
  programmata: 1,
  conclusa: 2,
  annullata: 3,
};

/**
 * What is on court now: a King/Queen group of 4 plays one match at a time,
 * so each group shows its match in progress, or else its next one to play
 * (lowest round). Matches without a state (older publishers) are live.
 */
export function inCampoAdesso(matches: readonly LiveMatch[]): LiveMatch[] {
  const perGirone = new Map<string, LiveMatch>();
  for (const m of matches) {
    const state = m.state ?? "in_corso";
    if (state !== "in_corso" && state !== "programmata") continue;
    if (m.state === undefined) {
      perGirone.set(`${m.groupId}:${m.id}`, m);
      continue;
    }
    const current = perGirone.get(m.groupId);
    if (!current || ordinaMiePartite([m, current])[0] === m) {
      perGirone.set(m.groupId, m);
    }
  }
  return [...perGirone.values()];
}

function byCourt(a: LiveMatch, b: LiveMatch): number {
  return courts.compare(a.court, b.court) || a.id.localeCompare(b.id);
}

/**
 * Court order for «In campo adesso»: the player's matches first, then by
 * court in natural order («Campo 2» before «Campo 10»), then by id.
 */
export function ordinaPartite(
  matches: readonly LiveMatch[],
  me: LiveMe,
): LiveMatch[] {
  return [...matches].sort(
    (a, b) =>
      Number(isMiaPartita(b, me)) - Number(isMiaPartita(a, me)) ||
      byCourt(a, b),
  );
}

/** The player's own matches: in progress first, then by round and court. */
export function ordinaMiePartite(matches: readonly LiveMatch[]): LiveMatch[] {
  return [...matches].sort(
    (a, b) =>
      STATE_ORDER[a.state ?? "in_corso"] - STATE_ORDER[b.state ?? "in_corso"] ||
      (a.round ?? 0) - (b.round ?? 0) ||
      byCourt(a, b),
  );
}

/** The matches and groups of one stage in a (global) live snapshot. */
export function soloTappa(
  snapshot: LiveSnapshot,
  stageId: string,
): Pick<LiveSnapshot, "matches" | "groups"> {
  return {
    matches: snapshot.matches.filter((m) => m.stageId === stageId),
    groups: snapshot.groups.filter((g) => g.stageId === stageId),
  };
}

/** Everything w-live shows for `me`, from the stage's live data. */
export function vistaLive(
  data: Pick<LiveSnapshot, "matches" | "groups">,
  me: LiveMe,
): VistaLive {
  const mie = ordinaMiePartite(
    data.matches.filter((m) => isMiaPartita(m, me) && m.state !== "annullata"),
  );
  const mioGirone =
    (me &&
      (data.groups.find((g) => g.rows.some((r) => r.playerId === me)) ??
        data.groups.find((g) => g.id === mie[0]?.groupId))) ||
    null;
  const inCampo = ordinaPartite(
    inCampoAdesso(data.matches).filter((m) => !isMiaPartita(m, me)),
    me,
  );
  return { mie, mioGirone, inCampo };
}

/** «21–19 · 15–13»: the scores as shown (en dash, no wrapping inside). */
export function punteggioVisibile(match: LiveMatch): string {
  return match.sets.map(([h, a]) => `${h}–${a}`).join(" · ");
}

/**
 * One short sentence for the announcer. The player's own result says so
 * («La tua partita: 21-19», from the player's side); anything else reads
 * like the other live pages.
 */
export function annuncioPartita(event: LiveEvent, me: LiveMe): string {
  if (event.type === "score") {
    const lato = mioLato(event.match, me);
    const last = event.match.sets.at(-1);
    if (lato) {
      if (!last) return "La tua partita: punteggio azzerato";
      const [mine, theirs] = lato === "home" ? last : [last[1], last[0]];
      return `La tua partita: ${mine}-${theirs}`;
    }
  }
  if (
    event.type === "group-standings" &&
    me &&
    event.group.rows.some((r) => r.playerId === me)
  ) {
    return `Classifica del tuo girone aggiornata`;
  }
  return announcementFor(event);
}

/** Events of this stage that w-live reads aloud. */
export function eventoDellaTappa(event: LiveEvent, stageId: string): boolean {
  if (event.type === "score") return event.match.stageId === stageId;
  if (event.type === "group-standings") return event.group.stageId === stageId;
  // A new game phase of this stage (BLVS-39: gold/silver groups, finals).
  if (event.type === "phase-started") return event.phase.stageId === stageId;
  return false;
}
