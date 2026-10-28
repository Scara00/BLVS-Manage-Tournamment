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

/** The page of one group of a stage (w-girone, BLVS-47). */
export function gironeTappaHref(id: string, gironeId: string): string {
  return `${tappaHref(id)}/gironi/${encodeURIComponent(gironeId)}`;
}
