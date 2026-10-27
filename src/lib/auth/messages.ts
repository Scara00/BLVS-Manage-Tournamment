import { formatServerTime } from "@/lib/time/server-time";

/** User-facing copy of the auth API (route files may only export handlers). */
export const INVALID_CREDENTIALS_MESSAGE = "Email o password non corretti.";

export const MIN_PASSWORD_LENGTH = 10;

export const REGISTERED_MESSAGE =
  "Registrazione ricevuta. Se l'indirizzo è valido riceverai un'email per confermare l'account.";

/**
 * Login suspended after repeated failures, with the wait written out:
 * «… Riprova tra 12 minuti, dalle 14:35.» (Europe/Rome).
 */
export function rateLimitedLoginMessage(
  retryAt: Date,
  retryAfterSeconds: number,
): string {
  const minutes = Math.max(1, Math.ceil(retryAfterSeconds / 60));
  const wait = minutes === 1 ? "1 minuto" : `${minutes} minuti`;
  const time = formatServerTime(retryAt, { timeStyle: "short" });
  return `Accesso sospeso per troppi tentativi non riusciti. Riprova tra ${wait}, dalle ${time}.`;
}
