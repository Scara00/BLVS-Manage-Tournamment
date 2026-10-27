/** User-facing copy of the password reset flow (shared by API and UI). */

/** Same answer whether or not the address has an account (no enumeration). */
export const RESET_REQUESTED_MESSAGE =
  "Se l'indirizzo è registrato riceverai un'email con il link per scegliere una nuova password.";

export const RESET_LINK_INVALID_MESSAGE =
  "Il link è scaduto o è già stato usato. Chiedine uno nuovo.";

export const PASSWORD_UPDATED_MESSAGE =
  "Password aggiornata. Abbiamo chiuso le sessioni aperte sugli altri dispositivi.";

export const OTHER_SESSIONS_NOT_CLOSED_MESSAGE =
  "Password aggiornata, ma non siamo riusciti a chiudere le sessioni sugli altri dispositivi: esci da lì o riprova a cambiare la password più tardi.";

export const SAME_PASSWORD_MESSAGE =
  "Scegli una password diversa da quella attuale.";

export const WEAK_PASSWORD_MESSAGE =
  "Password troppo debole: allungala o rendila meno comune.";

/** Minutes a reset link stays valid (`otp_expiry` in supabase/config.toml). */
export const RESET_LINK_VALIDITY_MINUTES = 60;

/** Seconds before «Invia di nuovo» (`max_frequency` in supabase/config.toml). */
export const RESEND_COOLDOWN_SECONDS = 60;

/** `?motivo=` on /password-dimenticata when the user comes from a dead link. */
export const EXPIRED_LINK_REASON = "link-scaduto";

export const FORGOT_PASSWORD_PATH = "/password-dimenticata";
export const RESET_PASSWORD_PATH = "/reimposta-password";
/** Login page (BLVS-13). */
export const LOGIN_PATH = "/accesso";
