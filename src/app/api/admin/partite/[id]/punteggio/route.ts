import {
  dbErrorResponse,
  invalid,
  malformedBody,
  notFound,
  readJsonObject,
} from "@/lib/api/responses";
import { BodyReader, isUuid } from "@/lib/api/validation";
import { withAdmin } from "@/lib/auth/guards";
import type { Punteggio, SetPunteggio } from "@/lib/db/types";

type Context = RouteContext<"/api/admin/partite/[id]/punteggio">;

const MAX_SETS = 5;
const MAX_PUNTI = 99;

function readSets(raw: unknown): SetPunteggio[] | null {
  if (!Array.isArray(raw) || raw.length > MAX_SETS) return null;
  const sets: SetPunteggio[] = [];
  for (const item of raw) {
    const { a, b } = (item ?? {}) as Record<string, unknown>;
    const valid = (n: unknown): n is number =>
      typeof n === "number" && Number.isInteger(n) && n >= 0 && n <= MAX_PUNTI;
    if (!valid(a) || !valid(b)) return null;
    sets.push({ a, b });
  }
  return sets;
}

/**
 * PUT /api/admin/partite/:id/punteggio — `{ sets: [{a, b}], versione }`.
 * `versione` is the one the client read: if someone saved in the meantime
 * the answer is 409 with the current score, nothing is overwritten.
 */
export const PUT = withAdmin<Context>(
  async (request, { params }, { supabase, id: userId }) => {
    const { id } = await params;
    if (!isUuid(id)) return notFound();
    const body = await readJsonObject(request);
    if (!body) return malformedBody();

    const reader = new BodyReader(body);
    const versione = reader.integer("versione", { min: 1 });
    const sets = readSets(body.sets);
    if (!sets)
      reader.errors.sets = `Da 0 a ${MAX_SETS} set con punti interi tra 0 e ${MAX_PUNTI}.`;
    if (!reader.ok || versione === undefined || !sets)
      return invalid(reader.errors);

    const columns = "partita_id, sets, versione, aggiornato_da, updated_at";
    const { data, error } = await supabase
      .from("punteggi")
      .update({ sets, versione: versione + 1, aggiornato_da: userId })
      .eq("partita_id", id)
      .eq("versione", versione)
      .select(columns)
      .maybeSingle<Punteggio>();
    if (error) return dbErrorResponse(error);
    if (data) return Response.json({ punteggio: data });

    const current = await supabase
      .from("punteggi")
      .select(columns)
      .eq("partita_id", id)
      .maybeSingle<Punteggio>();
    if (current.error) return dbErrorResponse(current.error);
    if (!current.data) return notFound();
    return Response.json(
      {
        error:
          "Il punteggio è stato modificato da qualcun altro. Ricarica e riprova.",
        punteggio: current.data,
      },
      { status: 409 },
    );
  },
);
