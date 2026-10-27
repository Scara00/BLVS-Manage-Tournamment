import {
  dbErrorResponse,
  invalid,
  malformedBody,
  notFound,
  readJsonObject,
} from "@/lib/api/responses";
import { BodyReader, isUuid } from "@/lib/api/validation";
import { withAdmin } from "@/lib/auth/guards";
import { RUOLI } from "@/lib/db/types";

type Context = RouteContext<"/api/admin/utenti/[id]/ruolo">;

/** PATCH /api/admin/utenti/:id/ruolo — `{ ruolo }`. An admin cannot demote themselves. */
export const PATCH = withAdmin<Context>(async (request, { params }, user) => {
  const { id } = await params;
  if (!isUuid(id)) return notFound();
  const body = await readJsonObject(request);
  if (!body) return malformedBody();
  const reader = new BodyReader(body);
  const ruolo = reader.oneOf("ruolo", RUOLI);
  if (reader.ok && id === user.id && ruolo !== "admin") {
    reader.errors.ruolo = "Non puoi toglierti il ruolo di admin.";
  }
  if (!reader.ok) return invalid(reader.errors);

  const { data, error } = await user.supabase
    .from("utenti")
    .update({ ruolo })
    .eq("id", id)
    .select("id, email, ruolo, categoria, nome, cognome")
    .maybeSingle();
  if (error) return dbErrorResponse(error);
  return data ? Response.json({ utente: data }) : notFound();
});
