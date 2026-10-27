import type { NextRequest } from "next/server";
import {
  invalid,
  jsonError,
  malformedBody,
  readJsonObject,
} from "@/lib/api/responses";
import {
  CONFIRM_EMAIL_MESSAGE,
  EMAIL_TAKEN_MESSAGE,
  REGISTERED_MESSAGE,
} from "@/lib/auth/messages";
import { limitAuthAttempt } from "@/lib/auth/rate-limit";
import { readSignup } from "@/lib/auth/signup";
import { PRIVACY_POLICY_VERSION } from "@/lib/legal/privacy-policy";
import { readSupabaseEnv } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

/**
 * POST /api/auth/register — public sign-up of a player:
 * `{ email, password, nome, cognome, categoria, consensoPrivacy: true }`.
 * The account is always a player (the DB trigger ignores any role); the
 * accepted privacy notice version and its date are recorded in `consensi`.
 * The password goes only to Supabase Auth (bcrypt) and is never logged.
 *
 * 201 `{ messaggio, connesso }`: `connesso` is true when Supabase returned
 * a session (cookies set), false when the email must be confirmed first.
 * 409 `fields.email` when the email is taken (BLVS-12 shows it next to the
 * field with a link «Accedi»; the rate limit caps enumeration).
 */
export async function POST(request: NextRequest) {
  const body = await readJsonObject(request);
  const loose = typeof body?.email === "string" ? body.email : null;

  const limited = await limitAuthAttempt(request, "register", loose);
  if (limited) return limited;
  if (!body) return malformedBody();

  const signup = readSignup(body);
  if (!signup.ok) return invalid(signup.errors);
  const { values } = signup;

  if (!readSupabaseEnv())
    return jsonError(503, "Autenticazione non configurata.");

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email: values.email,
    password: values.password,
    options: {
      data: {
        nome: values.nome,
        cognome: values.cognome,
        categoria: values.categoria,
        consenso_privacy: PRIVACY_POLICY_VERSION.number,
        consenso_privacy_data: PRIVACY_POLICY_VERSION.date,
      },
    },
  });

  if (error) {
    if (error.code === "weak_password") {
      return invalid({
        password: "Password troppo debole: allungala o rendila meno comune.",
      });
    }
    if (error.code === "user_already_exists" || error.code === "email_exists")
      return emailTaken();
    console.error("[auth] registrazione non riuscita", error);
    return jsonError(500, "Registrazione non riuscita. Riprova più tardi.");
  }

  // With email confirmation on, Supabase answers an existing email with a
  // fake user that has no identities instead of an error.
  if (data.user && data.user.identities?.length === 0) return emailTaken();

  const connesso = data.session != null;
  return Response.json(
    {
      messaggio: connesso ? REGISTERED_MESSAGE : CONFIRM_EMAIL_MESSAGE,
      connesso,
    },
    { status: 201 },
  );
}

function emailTaken(): Response {
  return jsonError(409, EMAIL_TAKEN_MESSAGE, {
    fields: { email: EMAIL_TAKEN_MESSAGE },
  });
}
