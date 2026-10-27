export const TAPPE_PATH = "/tappe";

/**
 * A stage's detail page, where the player registers.
 * TODO(BLVS-24): keep in sync with the detail route once it lands.
 */
export function tappaHref(id: string): string {
  return `${TAPPE_PATH}/${encodeURIComponent(id)}`;
}
