export const TAPPE_PATH = "/tappe";

/** A stage's detail page (w-tappa), where the player registers. */
export function tappaHref(id: string): string {
  return `${TAPPE_PATH}/${encodeURIComponent(id)}`;
}

/** The registration confirmation (w-iscrizione-ok) of a stage. */
export function iscrizioneHref(id: string): string {
  return `${tappaHref(id)}/iscrizione`;
}

/** The player live screen of a stage (w-live, BLVS-36). */
export function liveTappaHref(id: string): string {
  return `${tappaHref(id)}/live`;
}

/** The live resync of one stage (snapshot of its matches and groups). */
export function liveTappaSnapshotUrl(id: string): string {
  return `/api/live/snapshot?tappa=${encodeURIComponent(id)}`;
}

/**
 * The stage standing of a stage (w-classifica-tappa, BLVS-49), for one
 * category; without one the page picks the player's own.
 */
export function classificaTappaHref(id: string, categoria?: "M" | "F"): string {
  const base = `${tappaHref(id)}/classifica`;
  return categoria ? `${base}?categoria=${categoria}` : base;
}

/** The live resync of one board's stage standing. */
export function classificaTappaSnapshotUrl(
  id: string,
  categoria: "M" | "F",
): string {
  return `/api/live/snapshot?classificaTappa=${encodeURIComponent(`${id}:${categoria}`)}`;
}
