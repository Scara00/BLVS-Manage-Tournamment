/** User-facing copy of the auth API (route files may only export handlers). */
export const INVALID_CREDENTIALS_MESSAGE = "Email o password non corretti.";

export const MIN_PASSWORD_LENGTH = 10;

/** Signed up and signed in (email confirmation is off until BLVS-15). */
export const REGISTERED_MESSAGE = "Account creato: sei connesso.";

/** Signed up but the project requires confirming the email first. */
export const CONFIRM_EMAIL_MESSAGE =
  "Account creato. Ti abbiamo inviato un'email per confermare l'indirizzo.";

/** Shown next to the email field, followed by a link «Accedi». */
export const EMAIL_TAKEN_MESSAGE = "Questa email è già registrata.";
