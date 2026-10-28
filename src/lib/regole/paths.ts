/** w-regole (BLVS-46): the rules and points page, public. */
export const REGOLE_PATH = "/regole";

/** Anchors of the sections, for links from other pages. */
export const REGOLE_ANCORE = {
  formato: "formato",
  set: "set",
  spareggiGirone: "spareggi-girone",
  punti: "punti",
  spareggiGenerale: "classifica-generale",
} as const;

export function regoleHref(ancora?: keyof typeof REGOLE_ANCORE): string {
  return ancora ? `${REGOLE_PATH}#${REGOLE_ANCORE[ancora]}` : REGOLE_PATH;
}
