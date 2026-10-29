/**
 * Result of the «Accedi» server action, kept outside the "use server" module
 * so client components can import it. On success the action redirects, so
 * only failures carry data.
 */
export type SignInStatus =
  | "idle"
  | "fieldErrors"
  | "invalid"
  | "rateLimited"
  | "permissionDenied"
  | "noProfile"
  | "unavailable";

export type SignInField = "email" | "password";

export type SignInState = {
  status: SignInStatus;
  /** Per-field messages, mapped onto `Field error`. */
  fieldErrors?: Partial<Record<SignInField, string>>;
  /** Form-level message (generic credentials error, wait time, …). */
  message?: string;
  /** ISO time when a suspended login may be retried. */
  retryAt?: string;
  /** Email to put back in the field after a failure (never the password). */
  email?: string;
  /** Bumped on every failure, so focus moves to the error every time. */
  attempt: number;
};

export const initialSignInState: SignInState = { status: "idle", attempt: 0 };

export const LOGIN_UNAVAILABLE_MESSAGE =
  "Accesso momentaneamente non disponibile. Riprova tra poco.";

export const PERMISSION_DENIED_MESSAGE =
  "Accesso effettuato, ma il tuo account non può aprire la pagina da cui sei partito: è riservata agli amministratori.";

/** Signed in at Auth, but no usable profile (deleted or missing account). */
export const NO_PROFILE_MESSAGE =
  "Email e password sono giuste, ma questo account non ha più un profilo valido: forse è stato cancellato. Chiedi a un amministratore di controllarlo.";
