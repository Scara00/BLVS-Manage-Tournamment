import type { NextRequest } from "next/server";
import {
  invalid,
  jsonError,
  malformedBody,
  readJsonObject,
} from "@/lib/api/responses";
import { BodyReader } from "@/lib/api/validation";
import { INVALID_CREDENTIALS_MESSAGE } from "@/lib/auth/messages";
import { limitAuthAttempt } from "@/lib/auth/rate-limit";
import { readSupabaseEnv } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

/** POST /api/auth/login — `{ email, password }`; sets the session cookies. */
export async function POST(request: NextRequest) {
  const body = await readJsonObject(request);
  const loose = typeof body?.email === "string" ? body.email : null;

  // Every attempt counts, even malformed ones.
  const limited = await limitAuthAttempt(request, "login", loose);
  if (limited) return limited;
  if (!body) return malformedBody();

  const reader = new BodyReader(body);
  const email = reader.email();
  const password = reader.password();
  if (!reader.ok || !email || !password) return invalid(reader.errors);

  if (!readSupabaseEnv())
    return jsonError(503, "Autenticazione non configurata.");

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error || !data.user) {
    // Same answer for unknown email and wrong password (no enumeration).
    if (error && error.status !== 400)
      console.error("[auth] login non riuscito", error);
    return jsonError(401, INVALID_CREDENTIALS_MESSAGE);
  }

  return Response.json({
    utente: { id: data.user.id, email: data.user.email },
  });
}
