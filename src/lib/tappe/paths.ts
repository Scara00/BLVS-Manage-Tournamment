export const TAPPE_PATH = "/tappe";

/** A stage's detail page (w-tappa), where the player registers. */
export function tappaHref(id: string): string {
  return `${TAPPE_PATH}/${encodeURIComponent(id)}`;
}

/** The registration confirmation (w-iscrizione-ok) of a stage. */
export function iscrizioneHref(id: string): string {
  return `${tappaHref(id)}/iscrizione`;
}
