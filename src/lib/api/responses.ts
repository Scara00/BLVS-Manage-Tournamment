/**
 * JSON error contract of every API route: a user-facing Italian message and,
 * for validation failures, one message per field (map them onto the `error`
 * prop of Field / Fieldset / RadioCardGroup).
 */
export type FieldErrors = Record<string, string>;

export type ApiErrorBody = {
  error: string;
  fields?: FieldErrors;
};

export function jsonError(
  status: number,
  error: string,
  init: { fields?: FieldErrors; headers?: HeadersInit } = {},
): Response {
  const body: ApiErrorBody = init.fields
    ? { error, fields: init.fields }
    : { error };
  return Response.json(body, { status, headers: init.headers });
}

export const FORBIDDEN_MESSAGE = "Accesso negato.";

export function forbidden(): Response {
  return jsonError(403, FORBIDDEN_MESSAGE);
}

export function invalid(fields: FieldErrors): Response {
  return jsonError(422, "Controlla i campi evidenziati.", { fields });
}

export function notFound(): Response {
  return jsonError(404, "Risorsa non trovata.");
}

export function noContent(): Response {
  return new Response(null, { status: 204 });
}

type PostgrestLikeError = { code?: string; message?: string };

/**
 * Maps a database error onto an HTTP status. Constraint violations are
 * expected (e.g. a duplicate registration), anything else is logged.
 */
export function dbErrorResponse(error: PostgrestLikeError): Response {
  switch (error.code) {
    case "23505":
      return jsonError(409, "Esiste già un elemento con questi dati.");
    case "23503":
    case "23514":
    case "22P02":
    case "22007":
      return jsonError(422, "I dati non rispettano i vincoli richiesti.");
    case "42501":
      return forbidden();
    case "PGRST116":
      return notFound();
    default:
      console.error("[api] errore del database", error);
      return jsonError(500, "Errore interno. Riprova più tardi.");
  }
}

/** Reads a JSON object body, or `null` when it is missing or malformed. */
export async function readJsonObject(
  request: Request,
): Promise<Record<string, unknown> | null> {
  try {
    const body: unknown = await request.json();
    return body && typeof body === "object" && !Array.isArray(body)
      ? (body as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

export function malformedBody(): Response {
  return jsonError(400, "Richiesta non valida: atteso un oggetto JSON.");
}
