import type { FieldErrors } from "@/lib/api/responses";
import { BodyReader } from "@/lib/api/validation";
import { CATEGORIE, type Categoria } from "@/lib/db/types";
import { MIN_PASSWORD_LENGTH } from "./messages";

/**
 * Sign-up validation shared by the «Registrati» form (client) and
 * `POST /api/auth/register` (server), so both show the same messages.
 * Plain module: no server-only imports.
 */

/** Body of `POST /api/auth/register`, and the form's field names. */
export type SignupInput = {
  nome: string;
  cognome: string;
  email: string;
  password: string;
  categoria: Categoria | "";
  consensoPrivacy: boolean;
};

export type SignupValues = {
  nome: string;
  cognome: string;
  /** Trimmed and lowercased. */
  email: string;
  password: string;
  categoria: Categoria;
};

export const CONSENT_REQUIRED_MESSAGE =
  "Per registrarti devi accettare l'informativa privacy.";

export const CATEGORY_REQUIRED_MESSAGE = "Scegli la categoria in cui giochi.";

export type SignupResult =
  { ok: true; values: SignupValues } | { ok: false; errors: FieldErrors };

export function readSignup(body: Record<string, unknown>): SignupResult {
  const reader = new BodyReader(body);
  const values = {
    nome: reader.text("nome", { max: 100 }),
    cognome: reader.text("cognome", { max: 100 }),
    email: reader.email(),
    password: reader.password("password", { min: MIN_PASSWORD_LENGTH }),
    categoria: reader.oneOf("categoria", CATEGORIE),
  };
  reader.literal("consensoPrivacy", true, CONSENT_REQUIRED_MESSAGE);

  if (!reader.ok) {
    const errors = { ...reader.errors };
    if (errors.categoria === "Campo obbligatorio.") {
      errors.categoria = CATEGORY_REQUIRED_MESSAGE;
    }
    return { ok: false, errors };
  }
  return { ok: true, values: values as SignupValues };
}
