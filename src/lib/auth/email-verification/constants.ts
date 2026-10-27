/**
 * BLVS-15 · Conferma dell'indirizzo email (w-email-verify). Plain module:
 * client components, route handlers and tests share these values.
 *
 * Supabase Auth sends the link and owns the token: a resend replaces the
 * token, so the previous link stops working. The values below mirror
 * `[auth.email]` in supabase/config.toml (`config.test.ts` compares them).
 */

/** `otp_expiry`: how long a confirmation link stays valid. */
export const CONFIRMATION_LINK_TTL_SECONDS = 3600;

/** `max_frequency`: minimum wait between two confirmation emails. */
export const RESEND_COOLDOWN_SECONDS = 60;

/** Step 2 of 3 of the registration (step 1 is `/registrati`, BLVS-12). */
export const EMAIL_VERIFY_PATH = "/registrati/conferma-email";

/** Target of the link in the email (`supabase/templates/conferma-email.html`). */
export const EMAIL_VERIFY_CALLBACK_PATH = `${EMAIL_VERIFY_PATH}/verifica`;

/** POST: sends a new link and invalidates the previous one. */
export const EMAIL_RESEND_API = "/api/auth/conferma-email/reinvio";

/** Step 3 of 3: the player picks the first stage. */
export const AFTER_CONFIRMATION_PATH = "/tappe";

/** Query parameter set by the callback on the page. */
export const OUTCOME_PARAM = "esito";

export const OUTCOMES = ["confermata", "scaduto"] as const;
export type EmailVerifyOutcome = (typeof OUTCOMES)[number];

export function readOutcome(
  raw: string | string[] | undefined | null,
): EmailVerifyOutcome | null {
  const value = Array.isArray(raw) ? raw[0] : raw;
  return OUTCOMES.find((outcome) => outcome === value) ?? null;
}

/** The registration steps shown on top of every step page. */
export const REGISTRATION_STEPS = [
  "Dati e privacy",
  "Conferma email",
  "Prima tappa",
] as const;

/** States of the screen (Storybook stories use the same names). */
export type EmailVerifyStatus =
  "loading" | "waiting" | "success" | "sessionExpired" | "permissionDenied";

/** JSON answer of `POST EMAIL_RESEND_API` on success. */
export type ResendResponse = {
  /** ISO time the new link was sent. */
  inviataIl: string;
  /** ISO time the new link expires. */
  scadeIl: string;
  /** Seconds before another resend is allowed. */
  attesaSecondi: number;
};

/** JSON answer of `POST EMAIL_RESEND_API` on 403 / 429 / 5xx. */
export type ResendError = { error: string; attesaSecondi?: number };

export const EMAIL_NOT_CONFIRMED_MESSAGE =
  "Conferma la tua email prima di iscriverti a una tappa.";

export const NO_PENDING_VERIFICATION_MESSAGE =
  "Non c'è nessuna registrazione da confermare in questo browser.";

export const RESEND_TOO_SOON_MESSAGE =
  "Hai appena ricevuto un link: attendi prima di chiederne un altro.";

export const RESEND_FAILED_MESSAGE =
  "Non è stato possibile inviare l'email. Riprova più tardi.";
