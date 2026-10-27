import { readTappa, TAPPA_COLUMNS } from "@/lib/api/tappe";
import {
  dbErrorResponse,
  invalid,
  malformedBody,
  readJsonObject,
} from "@/lib/api/responses";
import { withAdmin } from "@/lib/auth/guards";

/** GET /api/admin/tappe — every stage, drafts included, with its two boards. */
export const GET = withAdmin(async (_request, _context, { supabase }) => {
  const { data, error } = await supabase
    .from("tappe")
    .select(TAPPA_COLUMNS)
    .order("data_inizio");
  if (error) return dbErrorResponse(error);
  return Response.json({ tappe: data });
});

/** POST /api/admin/tappe — creates a stage; the M and F boards come with it. */
export const POST = withAdmin(async (request, _context, { supabase }) => {
  const body = await readJsonObject(request);
  if (!body) return malformedBody();
  const { reader, values } = readTappa(body, false);
  if (!reader.ok) return invalid(reader.errors);

  const { data, error } = await supabase
    .from("tappe")
    .insert(values)
    .select(TAPPA_COLUMNS)
    .single();
  if (error) return dbErrorResponse(error);
  return Response.json({ tappa: data }, { status: 201 });
});
