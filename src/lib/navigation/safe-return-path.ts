/** Path of the «Informativa privacy» page. */
export const PRIVACY_PATH = "/privacy";

/** Query parameter carrying the page to go back to. */
export const RETURN_PARAM = "da";

const BASE = "http://blvs.invalid";

/**
 * Returns `raw` only when it is an internal path of this app, otherwise
 * `fallback`. Rejects absolute and protocol-relative URLs (`//evil.com`,
 * `/\evil.com`), schemes (`javascript:`), control characters and the
 * privacy page itself, so «Torna indietro» can never leave the site.
 */
export function safeReturnPath(
  raw: string | string[] | null | undefined,
  fallback = "/",
): string {
  if (typeof raw !== "string" || !raw.startsWith("/")) return fallback;
  // Browsers treat `\` like `/`, and strip tabs/newlines while parsing.
  if (raw.startsWith("//") || /[\\\s\u0000-\u001f\u007f]/.test(raw)) {
    return fallback;
  }
  let url: URL;
  try {
    url = new URL(raw, BASE);
  } catch {
    return fallback;
  }
  if (url.origin !== BASE) return fallback;
  if (url.pathname === PRIVACY_PATH) return fallback;
  return `${url.pathname}${url.search}${url.hash}`;
}

/** Link to the privacy page that brings the reader back to `from`. */
export function privacyHref(from?: string | null): string {
  const back = from ? safeReturnPath(from, "") : "";
  return back
    ? `${PRIVACY_PATH}?${RETURN_PARAM}=${encodeURIComponent(back)}`
    : PRIVACY_PATH;
}
