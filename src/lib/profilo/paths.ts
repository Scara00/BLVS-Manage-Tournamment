import { PROFILO_PATH } from "./types";

/**
 * Where a player whose session expired signs in again.
 * TODO(BLVS-13): replace with `sessionExpiredHref` from
 * `@/lib/navigation/auth-paths` once BLVS-13 is merged; this mirrors its
 * contract (`/sessione-scaduta?da=<path>`).
 */
export function profiloSessionExpiredHref(from: string = PROFILO_PATH): string {
  return `/sessione-scaduta?da=${encodeURIComponent(from)}`;
}

/**
 * Path the email-change confirmation link lands on (Supabase Auth
 * `emailRedirectTo`). The change is applied by Auth when the link is
 * opened, so the profile simply shows the new address.
 * TODO(BLVS-15): point it at the BLVS-15 confirmation route (which also
 * exchanges the PKCE code) once it is merged.
 */
export const EMAIL_CHANGE_REDIRECT_PATH = PROFILO_PATH;
