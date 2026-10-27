import { dbErrorResponse, invalid } from "@/lib/api/responses";
import { withAdmin } from "@/lib/auth/guards";

const PAGE_SIZE = 100;

/** GET /api/admin/registro?primaDi=<id> — audit log, newest first, 100 per page. */
export const GET = withAdmin(async (request, _context, { supabase }) => {
  const primaDi = request.nextUrl.searchParams.get("primaDi");
  if (primaDi && !/^\d+$/.test(primaDi))
    return invalid({ primaDi: "Valore non valido." });

  let query = supabase
    .from("registro")
    .select("id, attore_id, azione, entita, entita_id, dati, created_at")
    .order("id", { ascending: false })
    .limit(PAGE_SIZE);
  if (primaDi) query = query.lt("id", Number(primaDi));

  const { data, error } = await query;
  if (error) return dbErrorResponse(error);
  const last = data.at(-1);
  return Response.json({
    voci: data,
    prossima: data.length === PAGE_SIZE && last ? String(last.id) : null,
  });
});
