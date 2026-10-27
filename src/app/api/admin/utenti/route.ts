import { dbErrorResponse, invalid } from "@/lib/api/responses";
import { withAdmin } from "@/lib/auth/guards";
import { CATEGORIE, RUOLI, type Categoria, type Ruolo } from "@/lib/db/types";

/** GET /api/admin/utenti?ruolo=&categoria= — accounts, by surname. */
export const GET = withAdmin(async (request, _context, { supabase }) => {
  const params = request.nextUrl.searchParams;
  const ruolo = params.get("ruolo");
  const categoria = params.get("categoria");
  if (ruolo && !RUOLI.includes(ruolo as Ruolo))
    return invalid({ ruolo: "Valore non ammesso." });
  if (categoria && !CATEGORIE.includes(categoria as Categoria)) {
    return invalid({ categoria: "Valore non ammesso." });
  }

  let query = supabase
    .from("utenti")
    .select("id, email, ruolo, categoria, nome, cognome, created_at")
    .order("cognome")
    .order("nome");
  if (ruolo) query = query.eq("ruolo", ruolo);
  if (categoria) query = query.eq("categoria", categoria);

  const { data, error } = await query;
  if (error) return dbErrorResponse(error);
  return Response.json({ utenti: data });
});
