import { readTappa, TAPPA_COLUMNS } from "@/lib/api/tappe";
import {
  dbErrorResponse,
  invalid,
  malformedBody,
  noContent,
  notFound,
  readJsonObject,
} from "@/lib/api/responses";
import { isUuid } from "@/lib/api/validation";
import { withAdmin } from "@/lib/auth/guards";

type Context = RouteContext<"/api/admin/tappe/[id]">;

/** GET /api/admin/tappe/:id */
export const GET = withAdmin<Context>(
  async (_request, { params }, { supabase }) => {
    const { id } = await params;
    if (!isUuid(id)) return notFound();
    const { data, error } = await supabase
      .from("tappe")
      .select(TAPPA_COLUMNS)
      .eq("id", id)
      .maybeSingle();
    if (error) return dbErrorResponse(error);
    return data ? Response.json({ tappa: data }) : notFound();
  },
);

/** PATCH /api/admin/tappe/:id — updates only the fields sent. */
export const PATCH = withAdmin<Context>(
  async (request, { params }, { supabase }) => {
    const { id } = await params;
    if (!isUuid(id)) return notFound();
    const body = await readJsonObject(request);
    if (!body) return malformedBody();
    const { reader, values } = readTappa(body, true);
    if (!reader.ok) return invalid(reader.errors);

    const { data, error } = await supabase
      .from("tappe")
      .update(values)
      .eq("id", id)
      .select(TAPPA_COLUMNS)
      .maybeSingle();
    if (error) return dbErrorResponse(error);
    return data ? Response.json({ tappa: data }) : notFound();
  },
);

/** DELETE /api/admin/tappe/:id — removes the stage with boards and registrations. */
export const DELETE = withAdmin<Context>(
  async (_request, { params }, { supabase }) => {
    const { id } = await params;
    if (!isUuid(id)) return notFound();
    const { data, error } = await supabase
      .from("tappe")
      .delete()
      .eq("id", id)
      .select("id");
    if (error) return dbErrorResponse(error);
    return data.length > 0 ? noContent() : notFound();
  },
);
