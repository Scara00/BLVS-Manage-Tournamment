import type { NextRequest } from "next/server";
import {
  invalid,
  jsonError,
  malformedBody,
  readJsonObject,
} from "@/lib/api/responses";
import { newPasswordErrors } from "@/lib/auth/password-policy";
import {
  OTHER_SESSIONS_NOT_CLOSED_MESSAGE,
  PASSWORD_UPDATED_MESSAGE,
  RESET_LINK_INVALID_MESSAGE,
  SAME_PASSWORD_MESSAGE,
  WEAK_PASSWORD_MESSAGE,
} from "@/lib/auth/password-reset/messages";
import { hasRecentRecoverySession } from "@/lib/auth/password-reset/recovery-session";
import { limitAuthAttempt } from "@/lib/auth/rate-limit";
import { readSupabaseEnv } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

function linkInvalid(): Response {
  return Response.json(
    { error: RESET_LINK_INVALID_MESSAGE, stato: "link-non-valido" },
    { status: 410 },
  );
}

/**
 * POST /api/auth/password/reimposta — `{ tokenHash, password, conferma }`.
 *
 * 1. The password is checked first, so a weak one does not spend the link.
 * 2. `verifyOtp` spends the one-time token (Supabase keeps only its hash and
 *    expires it after 60 minutes) and opens a session on this device. An
 *    expired, used or unknown token → 410 `link-non-valido`.
 *    Without `tokenHash` (a retry after step 3 failed) the session must
 *    come from a recovery link in the last hour.
 * 3. `updateUser` sets the password.
 * 4. `signOut({ scope: "others" })` closes every other session of the user;
 *    this device stays signed in.
 */
export async function POST(request: NextRequest) {
  const limited = await limitAuthAttempt(request, "reset-confirm", null);
  if (limited) return limited;

  const body = await readJsonObject(request);
  if (!body) return malformedBody();

  const password = typeof body.password === "string" ? body.password : "";
  const conferma = typeof body.conferma === "string" ? body.conferma : "";
  const fields = newPasswordErrors(password, conferma);
  if (Object.keys(fields).length > 0) return invalid(fields);

  const tokenHash = body.tokenHash;
  if (
    tokenHash !== undefined &&
    (typeof tokenHash !== "string" || !tokenHash || tokenHash.length > 512)
  ) {
    return linkInvalid();
  }

  if (!readSupabaseEnv())
    return jsonError(503, "Autenticazione non configurata.");

  const supabase = await createClient();

  if (typeof tokenHash === "string") {
    const { error } = await supabase.auth.verifyOtp({
      type: "recovery",
      token_hash: tokenHash,
    });
    if (error) {
      // 4xx: expired, used or unknown token. Anything else is unexpected.
      if (!error.status || error.status >= 500)
        console.error(
          "[auth] verifica del link di recupero non riuscita",
          error,
        );
      return linkInvalid();
    }
  } else if (!(await hasRecentRecoverySession(supabase))) {
    return linkInvalid();
  }

  const { error: updateError } = await supabase.auth.updateUser({ password });
  if (updateError) {
    // The token is spent but this device holds the recovery session:
    // `sessioneRecupero` tells the form to retry without the token.
    const retry = { status: 422 } as const;
    if (updateError.code === "same_password") {
      return Response.json(
        {
          error: "Controlla i campi evidenziati.",
          fields: { password: SAME_PASSWORD_MESSAGE },
          sessioneRecupero: true,
        },
        retry,
      );
    }
    if (updateError.code === "weak_password") {
      return Response.json(
        {
          error: "Controlla i campi evidenziati.",
          fields: { password: WEAK_PASSWORD_MESSAGE },
          sessioneRecupero: true,
        },
        retry,
      );
    }
    console.error(
      "[auth] aggiornamento della password non riuscito",
      updateError,
    );
    return Response.json(
      {
        error: "Non siamo riusciti a salvare la password. Riprova.",
        sessioneRecupero: true,
      },
      { status: 500 },
    );
  }

  const closed = await closeOtherSessions(supabase);
  return Response.json({
    messaggio: closed
      ? PASSWORD_UPDATED_MESSAGE
      : OTHER_SESSIONS_NOT_CLOSED_MESSAGE,
    altreSessioniChiuse: closed,
  });
}

/** Revokes the user's other refresh tokens; one retry on failure. */
async function closeOtherSessions(
  supabase: Awaited<ReturnType<typeof createClient>>,
): Promise<boolean> {
  for (let attempt = 0; attempt < 2; attempt++) {
    const { error } = await supabase.auth.signOut({ scope: "others" });
    if (!error) return true;
    console.error("[auth] chiusura delle altre sessioni non riuscita", error);
  }
  return false;
}
