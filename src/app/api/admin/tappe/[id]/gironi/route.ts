import { jsonError, notFound } from "@/lib/api/responses";
import { isUuid } from "@/lib/api/validation";
import { withAdmin } from "@/lib/auth/guards";
import { generaGironi } from "@/lib/gironi/generazione/genera";

type Context = RouteContext<"/api/admin/tappe/[id]/gironi">;

/**
 * POST /api/admin/tappe/:id/gironi — draws the groups of 4 of both boards
 * and creates their 3 matches each (BLVS-26). 409 unless registrations are
 * closed or when a match has already started; a repeat call before that
 * regenerates everything. 201 `{ categorie: [{categoria, gironi, partite,
 * esclusi}] }`, where `esclusi` are the players left out of a full group.
 */
export const POST = withAdmin<Context>(
  async (_request, { params }, { supabase }) => {
    const { id } = await params;
    if (!isUuid(id)) return notFound();
    const esito = await generaGironi(supabase, id);
    if (!esito.ok) return jsonError(esito.status, esito.message);
    return Response.json({ categorie: esito.categorie }, { status: 201 });
  },
);
