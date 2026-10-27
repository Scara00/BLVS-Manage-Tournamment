import { notFound } from "@/lib/api/responses";
import { isDemoSeedEnabled } from "@/lib/demo/gestione-tappe-route";
import { creaDemoParita } from "@/lib/demo/parita";

/**
 * POST /api/demo/parita — e2e fixture (BLVS-38), 404 unless
 * TAPPE_DEMO_SEED=true: a stage in progress whose men's «Girone A» ends
 * in a perfect tie. Answers `{ id, categoria, gironeId }`.
 */
export async function POST() {
  if (!isDemoSeedEnabled()) return notFound();
  return Response.json(creaDemoParita(), { status: 201 });
}
