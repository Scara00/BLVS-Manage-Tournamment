import type { LiveEvent, LiveMatch } from "./types";

/**
 * Screen-reader announcements of a match's partial (BLVS-37, R-71): at most
 * one every 30 s per match, so a fast-moving score does not talk over
 * everything else. Configurable per screen (`LiveAnnouncer limita`).
 */
export const INTERVALLO_ANNUNCI_PARZIALE_MS = 30_000;

type StatoChiave = { dettoIl: number; inAttesa: string | null };

export type Proposta =
  /** Say it now. */
  | { dire: string }
  /** Kept as the newest pending text, said when the window reopens. */
  | { dire: null; traMs: number };

/**
 * Rate limit per key (a match id), pure and clock-free: callers pass the
 * time. Within the window only the NEWEST text is kept, and it is said when
 * the window reopens; `scarta` drops it (e.g. the official result arrived,
 * which is never limited).
 */
export function creaLimitatore(intervalloMs = INTERVALLO_ANNUNCI_PARZIALE_MS) {
  const chiavi = new Map<string, StatoChiave>();

  return {
    intervalloMs,
    proponi(chiave: string, testo: string, at: number): Proposta {
      const stato = chiavi.get(chiave);
      if (!stato || at - stato.dettoIl >= intervalloMs) {
        chiavi.set(chiave, { dettoIl: at, inAttesa: null });
        return { dire: testo };
      }
      stato.inAttesa = testo;
      return { dire: null, traMs: stato.dettoIl + intervalloMs - at };
    },
    /** Pending texts whose window has reopened; they count as said now. */
    maturi(at: number): string[] {
      const pronti: string[] = [];
      for (const stato of chiavi.values()) {
        if (stato.inAttesa !== null && at - stato.dettoIl >= intervalloMs) {
          pronti.push(stato.inAttesa);
          stato.inAttesa = null;
          stato.dettoIl = at;
        }
      }
      return pronti;
    },
    /** Earliest time a pending text is due, or null. */
    prossimo(): number | null {
      let primo: number | null = null;
      for (const stato of chiavi.values()) {
        if (stato.inAttesa === null) continue;
        const due = stato.dettoIl + intervalloMs;
        if (primo === null || due < primo) primo = due;
      }
      return primo;
    },
    /** Drops the pending text of a key. */
    scarta(chiave: string) {
      const stato = chiavi.get(chiave);
      if (stato) stato.inAttesa = null;
    },
  };
}

export type Limitatore = ReturnType<typeof creaLimitatore>;

/** A partial of a match in progress, the only thing that is limited. */
export function isParziale(match: LiveMatch): boolean {
  return (match.state ?? "in_corso") === "in_corso" && !!match.partial;
}

/** The key a `score` event is limited by: its match, when a partial. */
export function chiaveParziale(event: LiveEvent): string | null {
  return event.type === "score" && isParziale(event.match)
    ? event.match.id
    : null;
}

/** A `score` event that is NOT a partial (the result): never limited. */
export function chiaveRisultato(event: LiveEvent): string | null {
  return event.type === "score" && !isParziale(event.match)
    ? event.match.id
    : null;
}
