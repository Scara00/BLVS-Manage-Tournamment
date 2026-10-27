import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import {
  EMAIL_VERIFY_PATH,
  OUTCOME_PARAM,
  type EmailVerifyOutcome,
} from "@/lib/auth/email-verification/constants";
import { clearPendingVerification } from "@/lib/auth/email-verification/pending";
import { readSupabaseEnv } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

/** Types a confirmation link may carry (`type` in the email template). */
const CONFIRMATION_TYPES: readonly EmailOtpType[] = ["email", "signup"];

/**
 * GET /registrati/conferma-email/verifica?token_hash=…&type=email — target of
 * the link in the confirmation email. Supabase Auth checks the token: a link
 * that expired, was already used or was replaced by a newer one fails, and
 * the page shows «Link scaduto» with a new send. On success the user is
 * signed in (session cookies) and lands on the confirmed state.
 * The token never ends up in the redirect URL.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;

  let outcome: EmailVerifyOutcome = "scaduto";
  if (
    tokenHash &&
    type &&
    CONFIRMATION_TYPES.includes(type) &&
    readSupabaseEnv()
  ) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({
      type,
      token_hash: tokenHash,
    });
    if (!error) {
      outcome = "confermata";
      await clearPendingVerification();
    } else if (!error.status || error.status >= 500) {
      console.error("[auth] verifica del link di conferma non riuscita", error);
    }
  }

  const target = new URL(EMAIL_VERIFY_PATH, request.url);
  target.searchParams.set(OUTCOME_PARAM, outcome);
  const response = NextResponse.redirect(target, 303);
  response.headers.set("Cache-Control", "no-store");
  return response;
}
