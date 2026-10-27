import {
  RETURN_PARAM,
  safeReturnPath,
} from "@/lib/navigation/safe-return-path";

/** «Registrati» (BLVS-12). */
export const SIGNUP_PATH = "/registrati";

/** «Accedi» (w-login, BLVS-13): same path as `src/lib/navigation/auth-paths.ts` there. */
export const LOGIN_PATH = "/accesso";

/**
 * Where to go after signing up: the `?da=` page when it is internal and is
 * not the auth flow itself, otherwise the home.
 */
export function signupReturnPath(raw: string | null | undefined): string {
  const path = safeReturnPath(raw);
  const pathname = path.split(/[?#]/, 1)[0];
  return pathname === SIGNUP_PATH || pathname === LOGIN_PATH ? "/" : path;
}

function withReturn(base: string, returnTo: string): string {
  return returnTo === "/"
    ? base
    : `${base}?${RETURN_PARAM}=${encodeURIComponent(returnTo)}`;
}

/** Link to «Registrati» that comes back to `returnTo` once signed up. */
export function signupHref(returnTo = "/"): string {
  return withReturn(SIGNUP_PATH, signupReturnPath(returnTo));
}

/** Link to «Accedi» that keeps the page the user was heading to. */
export function loginHref(returnTo = "/"): string {
  return withReturn(LOGIN_PATH, signupReturnPath(returnTo));
}
