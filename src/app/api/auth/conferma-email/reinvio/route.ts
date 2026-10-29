import type { NextRequest } from "next/server";
import { invalid, jsonError, readJsonObject } from "@/lib/api/responses";
import { BodyReader } from "@/lib/api/validation";
import {
  NO_PENDING_VERIFICATION_MESSAGE,
  RESEND_COOLDOWN_SECONDS,
  RESEND_FAILED_MESSAGE,
  RESEND_TOO_SOON_MESSAGE,
  type ResendError,
  type ResendResponse,
} from "@/lib/auth/email-verification/constants";
import {
  linkExpiresAt,
  resendWaitSeconds,
} from "@/lib/auth/email-verification/format";
import {
  readPendingVerification,
  rememberPendingVerification,
} from "@/lib/auth/email-verification/pending";
import { checkAuthAttempt, clientIp } from "@/lib/auth/rate-limit";
import { readSupabaseEnv } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import { now } from "@/lib/time/server-time";

/**
 * POST /api/auth/conferma-email/reinvio — sends a new confirmation link.
 * Supabase Auth replaces the token, so the previous link stops working.
 *
 * The address comes from the pending-registration cookie, or from
 * `{ email }` when the link was opened in another browser (the same thing
 * Supabase's public `resend` allows). Nobody to confirm → 403.
 * Less than 60 s since the last link → 429 `{ attesaSecondi }`, checked here
 * first and again by Supabase Auth (`max_frequency`). Every request also
 * counts towards a limit per IP and per address (`verify-resend`), the
 * same 429, so naming addresses in the body cannot flood inboxes or spend
 * the project's email quota.
 * An unknown or already confirmed address gets the same 200 (no enumeration).
 */
export async function POST(request: NextRequest) {
  const body = (await readJsonObject(request)) ?? {};
  const pending = await readPendingVerification();

  let email = pending?.email ?? null;
  if (typeof body.email === "string" && body.email.trim() !== "") {
    const reader = new BodyReader(body);
    const fromBody = reader.email();
    if (!reader.ok || !fromBody) return invalid(reader.errors);
    email = fromBody;
  }
  if (!email) return jsonError(403, NO_PENDING_VERIFICATION_MESSAGE);

  const check = await checkAuthAttempt(
    clientIp(request),
    "verify-resend",
    email,
  );
  if (check.status === "unavailable")
    return jsonError(503, "Servizio momentaneamente non disponibile. Riprova.");
  if (check.status === "blocked") return tooSoon(check.retryAfterSeconds);

  if (pending && pending.email === email) {
    const wait = resendWaitSeconds(pending.inviataIl, now());
    if (wait > 0) return tooSoon(wait);
  }

  if (!readSupabaseEnv())
    return jsonError(503, "Autenticazione non configurata.");

  const supabase = await createClient();
  const { error } = await supabase.auth.resend({ type: "signup", email });
  if (error) {
    if (error.status === 429 || error.code === "over_email_send_rate_limit") {
      return tooSoon(retryAfterSeconds(error.message));
    }
    console.error("[auth] reinvio della conferma email non riuscito", error);
    return jsonError(500, RESEND_FAILED_MESSAGE);
  }

  const sentAt = now();
  await rememberPendingVerification(email, sentAt);
  const answer: ResendResponse = {
    inviataIl: sentAt.toISOString(),
    scadeIl: linkExpiresAt(sentAt).toISOString(),
    attesaSecondi: RESEND_COOLDOWN_SECONDS,
  };
  return Response.json(answer);
}

function tooSoon(seconds: number): Response {
  const body: ResendError = {
    error: RESEND_TOO_SOON_MESSAGE,
    attesaSecondi: seconds,
  };
  return Response.json(body, {
    status: 429,
    headers: { "Retry-After": String(seconds) },
  });
}

/** GoTrue says «…you can only request this after 42 seconds.» */
function retryAfterSeconds(message: string | undefined): number {
  const match = message?.match(/after (\d+) seconds?/);
  const seconds = match ? Number(match[1]) : RESEND_COOLDOWN_SECONDS;
  return Math.min(Math.max(seconds, 1), RESEND_COOLDOWN_SECONDS);
}
