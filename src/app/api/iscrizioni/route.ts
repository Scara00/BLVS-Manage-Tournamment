import type { NextRequest } from "next/server";
import {
  dbErrorResponse,
  forbidden,
  invalid,
  jsonError,
  malformedBody,
  notFound,
  readJsonObject,
} from "@/lib/api/responses";
import { isUuid } from "@/lib/api/validation";
import { EMAIL_NOT_CONFIRMED_MESSAGE } from "@/lib/auth/email-verification/constants";
import { getCurrentUser } from "@/lib/auth/session";
import {
  ALREADY_REGISTERED_MESSAGE,
  NO_CATEGORY_MESSAGE,
  STAGE_ARCHIVED_MESSAGE,
  STAGE_CANCELLED_MESSAGE,
} from "@/lib/iscrizioni/messages";
import type { Categoria } from "@/lib/db/types";

/**
 * POST /api/iscrizioni — `{ tappaId }`: the signed-in player signs up to a
 * stage, on the board of their category. Refused with 403 until the email
 * is confirmed (BLVS-15); the database enforces the same rule (trigger
 * `iscrizioni_email_confermata` + RLS), this check only gives the message.
 */
export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return forbidden();

  const body = await readJsonObject(request);
  if (!body) return malformedBody();
  const tappaId = body.tappaId;
  if (typeof tappaId !== "string" || !isUuid(tappaId))
    return invalid({ tappaId: "Tappa non valida." });

  const { supabase } = user;
  const { data: confermata, error: checkError } =
    await supabase.rpc("email_confermata");
  if (checkError) return dbErrorResponse(checkError);
  if (confermata !== true) return jsonError(403, EMAIL_NOT_CONFIRMED_MESSAGE);

  const { data: profilo, error: profileError } = await supabase
    .from("utenti")
    .select("categoria")
    .eq("id", user.id)
    .maybeSingle<{ categoria: Categoria | null }>();
  if (profileError) return dbErrorResponse(profileError);
  if (!profilo?.categoria) return jsonError(422, NO_CATEGORY_MESSAGE);

  const { data: tabellone, error: boardError } = await supabase
    .from("tabelloni")
    .select("id")
    .eq("tappa_id", tappaId)
    .eq("categoria", profilo.categoria)
    .maybeSingle<{ id: string }>();
  if (boardError) return dbErrorResponse(boardError);
  if (!tabellone) return notFound();

  const { data, error } = await supabase
    .from("iscrizioni")
    .insert({
      tappa_id: tappaId,
      tabellone_id: tabellone.id,
      utente_id: user.id,
    })
    .select("id, tappa_id, tabellone_id, utente_id, stato, created_at")
    .single();
  if (error) {
    if (error.code === "23505")
      return jsonError(409, ALREADY_REGISTERED_MESSAGE);
    // BLVS-22: the database refuses cancelled and archived stages.
    if (error.hint === "tappa_annullata")
      return jsonError(409, STAGE_CANCELLED_MESSAGE);
    if (error.hint === "tappa_archiviata")
      return jsonError(409, STAGE_ARCHIVED_MESSAGE);
    if (error.code === "42501" && error.message?.startsWith("Conferma"))
      return jsonError(403, EMAIL_NOT_CONFIRMED_MESSAGE);
    return dbErrorResponse(error);
  }
  return Response.json({ iscrizione: data }, { status: 201 });
}
