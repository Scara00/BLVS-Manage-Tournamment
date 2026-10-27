import { after, type NextRequest } from "next/server";
import {
  invalid,
  jsonError,
  malformedBody,
  readJsonObject,
} from "@/lib/api/responses";
import { BodyReader } from "@/lib/api/validation";
import { RESET_REQUESTED_MESSAGE } from "@/lib/auth/password-reset/messages";
import { sendRecoveryEmail } from "@/lib/auth/password-reset/send";
import { limitAuthAttempt } from "@/lib/auth/rate-limit";
import { readSupabaseEnv } from "@/lib/supabase/env";

/**
 * POST /api/auth/password/richiesta — `{ email }`; «Password dimenticata».
 * Always 202 with the same body for registered and unknown addresses, and
 * the email goes out in `after()`, once the response is sent: the answer
 * never waits on the account lookup or on SMTP, so its timing does not
 * reveal whether the account exists either.
 */
export async function POST(request: NextRequest) {
  const body = await readJsonObject(request);
  const loose = typeof body?.email === "string" ? body.email : null;

  const limited = await limitAuthAttempt(request, "reset-request", loose);
  if (limited) return limited;
  if (!body) return malformedBody();

  const reader = new BodyReader(body);
  const email = reader.email();
  if (!reader.ok || !email) return invalid(reader.errors);

  const env = readSupabaseEnv();
  if (!env) return jsonError(503, "Autenticazione non configurata.");

  after(() => sendRecoveryEmail(env, email));

  return Response.json({ messaggio: RESET_REQUESTED_MESSAGE }, { status: 202 });
}
