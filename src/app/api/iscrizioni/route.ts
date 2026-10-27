import type { NextRequest } from "next/server";
import {
  forbidden,
  invalid,
  jsonError,
  malformedBody,
  readJsonObject,
} from "@/lib/api/responses";
import { isUuid } from "@/lib/api/validation";
import { getCurrentUser } from "@/lib/auth/session";
import { iscriviGiocatore } from "@/lib/iscrizioni/iscrivi";

/**
 * POST /api/iscrizioni — `{ tappaId }`: the signed-in player takes the first
 * free seat on the board of their category. The database enforces every
 * rule in one locked transaction (RPC `iscriviti_tappa`, trigger
 * `iscrizioni_posti`): 403 until the email is confirmed (BLVS-15), 409 when
 * already registered, closed, past the deadline, cancelled or sold out, 404
 * with no details for a draft or a stage that does not exist.
 */
export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return forbidden();

  const body = await readJsonObject(request);
  if (!body) return malformedBody();
  const tappaId = body.tappaId;
  if (typeof tappaId !== "string" || !isUuid(tappaId))
    return invalid({ tappaId: "Tappa non valida." });

  const esito = await iscriviGiocatore(user.supabase, tappaId);
  if (!esito.ok) return jsonError(esito.status, esito.message);
  return Response.json({ iscrizione: esito.iscrizione }, { status: 201 });
}
