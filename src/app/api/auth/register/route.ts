import type { NextRequest } from "next/server";
import {
  invalid,
  jsonError,
  malformedBody,
  readJsonObject,
} from "@/lib/api/responses";
import { BodyReader } from "@/lib/api/validation";
import { MIN_PASSWORD_LENGTH, REGISTERED_MESSAGE } from "@/lib/auth/messages";
import { limitAuthAttempt } from "@/lib/auth/rate-limit";
import { CATEGORIE, VERSIONE_INFORMATIVA_PRIVACY } from "@/lib/db/types";
import { readSupabaseEnv } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

/**
 * POST /api/auth/register — public sign-up of a player:
 * `{ email, password, nome, cognome, categoria, consensoPrivacy: true }`.
 * The account is always a player (the DB trigger ignores any role); the
 * accepted privacy notice version is recorded in `consensi`.
 */
export async function POST(request: NextRequest) {
  const body = await readJsonObject(request);
  const loose = typeof body?.email === "string" ? body.email : null;

  const limited = await limitAuthAttempt(request, "register", loose);
  if (limited) return limited;
  if (!body) return malformedBody();

  const reader = new BodyReader(body);
  const values = {
    email: reader.email(),
    password: reader.password("password", { min: MIN_PASSWORD_LENGTH }),
    nome: reader.text("nome", { max: 100 }),
    cognome: reader.text("cognome", { max: 100 }),
    categoria: reader.oneOf("categoria", CATEGORIE),
    consenso: reader.literal(
      "consensoPrivacy",
      true,
      "Per registrarti devi accettare l'informativa privacy.",
    ),
  };
  if (!reader.ok) return invalid(reader.errors);

  if (!readSupabaseEnv())
    return jsonError(503, "Autenticazione non configurata.");

  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({
    email: values.email!,
    password: values.password!,
    options: {
      data: {
        nome: values.nome,
        cognome: values.cognome,
        categoria: values.categoria,
        consenso_privacy: VERSIONE_INFORMATIVA_PRIVACY,
      },
    },
  });

  if (error) {
    if (error.code === "weak_password") {
      return invalid({
        password: "Password troppo debole: allungala o rendila meno comune.",
      });
    }
    // An existing email gets the same answer as a new one (no enumeration).
    if (error.code !== "user_already_exists" && error.code !== "email_exists") {
      console.error("[auth] registrazione non riuscita", error);
      return jsonError(500, "Registrazione non riuscita. Riprova più tardi.");
    }
  }

  return Response.json({ messaggio: REGISTERED_MESSAGE }, { status: 202 });
}
