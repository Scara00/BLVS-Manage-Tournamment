import { notFound } from "@/lib/api/responses";
import { isDemoSeedEnabled } from "@/lib/demo/gestione-tappe-route";
import { creaGiocatoreDemo } from "@/lib/demo/giocatori-admin";

/**
 * POST /api/demo/giocatori — e2e fixture (BLVS-54), 404 unless
 * TAPPE_DEMO_SEED=true: a fresh men's player whose category is to verify,
 * registered to two future stages (the women's board of one is full).
 * Body `{ inCorso?: true }` adds a stage in progress, which blocks the
 * change. Answers `{ utenteId, nome }`.
 */
export async function POST(request: Request) {
  if (!isDemoSeedEnabled()) return notFound();
  const body: unknown = await request.json().catch(() => ({}));
  const inCorso =
    typeof body === "object" &&
    body !== null &&
    (body as { inCorso?: unknown }).inCorso === true;
  return Response.json(creaGiocatoreDemo({ inCorso }), { status: 201 });
}
