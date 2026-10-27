import type { ApiErrorBody, FieldErrors } from "@/lib/api/responses";
import { REGISTERED_MESSAGE } from "@/lib/auth/messages";
import type { SignupInput } from "@/lib/auth/signup";

export type SignupOutcome =
  /** Account created; `connesso` when the session cookies are set. */
  | { kind: "ok"; connesso: boolean; messaggio: string }
  /** The server rejected some fields (422, 409 email taken). */
  | { kind: "invalid"; error: string; fields: FieldErrors }
  /** Any other answer (429, 503, 500), with the server's message. */
  | { kind: "error"; error: string }
  /** No answer at all: offline, DNS, connection dropped. */
  | { kind: "network" };

export type SubmitSignup = (input: SignupInput) => Promise<SignupOutcome>;

export const SIGNUP_ENDPOINT = "/api/auth/register";

const GENERIC_ERROR = "Registrazione non riuscita. Riprova più tardi.";

/** Posts the form to `POST /api/auth/register`. Never throws. */
export const submitSignup: SubmitSignup = async (input) => {
  let response: Response;
  try {
    response = await fetch(SIGNUP_ENDPOINT, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input),
    });
  } catch {
    return { kind: "network" };
  }

  const body = (await response.json().catch(() => null)) as
    (Partial<ApiErrorBody> & { messaggio?: string; connesso?: boolean }) | null;

  if (response.ok) {
    return {
      kind: "ok",
      connesso: body?.connesso === true,
      messaggio: body?.messaggio ?? REGISTERED_MESSAGE,
    };
  }
  if (body?.fields && Object.keys(body.fields).length > 0) {
    return {
      kind: "invalid",
      error: body.error ?? GENERIC_ERROR,
      fields: body.fields,
    };
  }
  return { kind: "error", error: body?.error ?? GENERIC_ERROR };
};
