import type { FieldErrors } from "@/lib/api/responses";

/**
 * Outcome of a JSON POST from a form, already sorted into the states the
 * password forms show: offline (nothing was sent), network (no answer),
 * field errors, a dead reset link, or a message from the server.
 */
export type PostOutcome<T> =
  | { kind: "ok"; data: T }
  | { kind: "offline" }
  | { kind: "network" }
  | { kind: "fields"; message: string; fields: FieldErrors; body: ErrorBody }
  | { kind: "link-invalid"; message: string }
  | { kind: "error"; message: string; body: ErrorBody };

type ErrorBody = {
  error?: string;
  fields?: FieldErrors;
  stato?: string;
  sessioneRecupero?: boolean;
};

export const OFFLINE_MESSAGE =
  "Sei offline: non abbiamo inviato nulla. Controlla la connessione e riprova.";
export const NETWORK_MESSAGE =
  "Non riusciamo a raggiungere il server. Controlla la connessione e riprova.";
const GENERIC_ERROR_MESSAGE = "Qualcosa non ha funzionato. Riprova.";

export async function postJson<T>(
  url: string,
  body: unknown,
): Promise<PostOutcome<T>> {
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    return { kind: "offline" };
  }
  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    return { kind: "network" };
  }
  const json: unknown = await response.json().catch(() => null);
  if (response.ok) return { kind: "ok", data: json as T };

  const error: ErrorBody = json && typeof json === "object" ? json : {};
  const message = error.error ?? GENERIC_ERROR_MESSAGE;
  if (response.status === 410 || error.stato === "link-non-valido") {
    return { kind: "link-invalid", message };
  }
  if (error.fields && Object.keys(error.fields).length > 0) {
    return { kind: "fields", message, fields: error.fields, body: error };
  }
  return { kind: "error", message, body: error };
}
