import {
  adminNav,
  playerPrimaryNav,
  playerSecondaryNav,
} from "@/components/layout/nav-items";
import {
  FORGOT_PASSWORD_PATH,
  RESET_PASSWORD_PATH,
} from "@/lib/auth/password-reset/messages";
import { SIGNUP_PATH } from "@/lib/auth/paths";
import { REGOLE_PATH } from "@/lib/regole/paths";
import { PRIVACY_PATH, RETURN_PARAM, safeReturnPath } from "./safe-return-path";

/** Login page (w-login). */
export const LOGIN_PATH = "/accesso";

/** General standing (w-classifica): public, names and points only (BLVS-44). */
export const CLASSIFICA_PATH = "/classifica";

/** Expired session page (w-sessione-scaduta). */
export const SESSION_EXPIRED_PATH = "/sessione-scaduta";

/** Query flag on the login page after «Esci». */
export const SIGNED_OUT_PARAM = "uscita";

/** Query parameter on the login page saying why the user is there. */
export const REASON_PARAM = "motivo";

export type LoginReason = "scaduta";

/**
 * Pages a signed-out visitor may open; everything else needs a session.
 * Sign-up (with its email confirmation) and password reset come before
 * there is one; the general standing (BLVS-44) and the rules (BLVS-46)
 * are public.
 */
const PUBLIC_PATHS = [
  CLASSIFICA_PATH,
  REGOLE_PATH,
  PRIVACY_PATH,
  LOGIN_PATH,
  SESSION_EXPIRED_PATH,
  SIGNUP_PATH,
  FORGOT_PASSWORD_PATH,
  RESET_PASSWORD_PATH,
];

/** Error previews (BLVS-10) stay reachable without a session. */
const PUBLIC_PREFIXES = ["/anteprima/", "/admin/anteprima/"];

function matches(pathname: string, path: string): boolean {
  return pathname === path || pathname.startsWith(`${path}/`);
}

/** Whether `pathname` needs a signed-in user (API routes guard themselves). */
export function requiresSession(pathname: string): boolean {
  if (pathname === "/api" || pathname.startsWith("/api/")) return false;
  if (PUBLIC_PATHS.some((path) => matches(pathname, path))) return false;
  return !PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

/**
 * Where to go after signing in: an internal path from `?da=` (see
 * `safeReturnPath`), never the login or expired page itself (loops).
 */
export function safeAfterLoginPath(raw: string | string[] | null | undefined) {
  const path = safeReturnPath(raw);
  const { pathname } = new URL(path, "http://blvs.invalid");
  return matches(pathname, LOGIN_PATH) ||
    matches(pathname, SESSION_EXPIRED_PATH)
    ? "/"
    : path;
}

/** Link to the login page that brings the user back to `from` afterwards. */
export function loginHref(
  from?: string | null,
  { reason, signedOut }: { reason?: LoginReason; signedOut?: boolean } = {},
): string {
  const params = new URLSearchParams();
  const back = from ? safeAfterLoginPath(from) : "/";
  if (back !== "/") params.set(RETURN_PARAM, back);
  if (reason) params.set(REASON_PARAM, reason);
  if (signedOut) params.set(SIGNED_OUT_PARAM, "1");
  const query = params.toString();
  return query ? `${LOGIN_PATH}?${query}` : LOGIN_PATH;
}

/** Link to the expired-session page, remembering the page to go back to. */
export function sessionExpiredHref(from?: string | null): string {
  const back = from ? safeAfterLoginPath(from) : "/";
  return back === "/"
    ? SESSION_EXPIRED_PATH
    : `${SESSION_EXPIRED_PATH}?${RETURN_PARAM}=${encodeURIComponent(back)}`;
}

const NAMED_PAGES = [
  ...adminNav.map((item) => ({ ...item, label: `Admin · ${item.label}` })),
  ...playerPrimaryNav,
  ...playerSecondaryNav,
];

/**
 * Italian name of the page at `path`, for «Dopo l'accesso torni a: …».
 * The most specific section wins (`/admin/tappe/3` → «Admin · Tappe»).
 */
export function describeReturnPath(path: string): string {
  const { pathname } = new URL(safeAfterLoginPath(path), "http://blvs.invalid");
  const best = NAMED_PAGES.filter((item) =>
    item.href === "/" ? pathname === "/" : matches(pathname, item.href),
  ).sort((a, b) => b.href.length - a.href.length)[0];
  if (!best) return "la pagina che stavi consultando";
  return best.href === pathname ? best.label : `una pagina di ${best.label}`;
}
