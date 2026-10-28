/** The rules page (w-regole). */
export const REGOLE_PATH = "/regole";

/** A section of the rules page, e.g. `#spareggi` for the tie-breaks. */
export function regoleHref(sezione?: "spareggi"): string {
  return sezione ? `${REGOLE_PATH}#${sezione}` : REGOLE_PATH;
}
