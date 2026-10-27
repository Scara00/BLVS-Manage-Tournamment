import {
  dbErrorResponse,
  invalid,
  malformedBody,
  notFound,
  readJsonObject,
} from "@/lib/api/responses";
import { BodyReader, isUuid } from "@/lib/api/validation";
import { withAdmin } from "@/lib/auth/guards";
import { STATI_ISCRIZIONE } from "@/lib/db/types";

type Context = RouteContext<"/api/admin/iscrizioni/[id]">;

/** PATCH /api/admin/iscrizioni/:id — `{ stato }`: confirms or rejects a registration. */
export const PATCH = withAdmin<Context>(
  async (request, { params }, { supabase }) => {
    const { id } = await params;
    if (!isUuid(id)) return notFound();
    const body = await readJsonObject(request);
    if (!body) return malformedBody();
    const reader = new BodyReader(body);
    const stato = reader.oneOf("stato", STATI_ISCRIZIONE);
    if (!reader.ok) return invalid(reader.errors);

    const { data, error } = await supabase
      .from("iscrizioni")
      .update({ stato })
      .eq("id", id)
      .select(
        "id, tappa_id, tabellone_id, utente_id, stato, created_at, updated_at",
      )
      .maybeSingle();
    if (error) return dbErrorResponse(error);
    return data ? Response.json({ iscrizione: data }) : notFound();
  },
);
