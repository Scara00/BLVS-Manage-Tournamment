import { invalid, notFound } from "@/lib/api/responses";
import { pubblicaClassificaGenerale } from "@/lib/classifica-generale/pubblica";
import { isDemoSeedEnabled } from "@/lib/demo/gestione-tappe-route";
import {
  concludiTabelloniDemo,
  creaScenarioClassificaDemo,
  nomeTappaDemo,
  salvaFinaleDemo,
} from "@/lib/demo/classifica-generale";

/**
 * POST /api/demo/classifica-generale — e2e fixture (BLVS-44), 404 unless
 * TAPPE_DEMO_SEED=true.
 *
 * - `{}` creates a hidden season with a closed stage and an open one whose
 *   men's gold final misses a match: `{ stagione, categoria, tappaAperta }`.
 * - `{ tappaId, azione: "salva" }` enters that match as an admin would
 *   (every place becomes definitive), then publishes the standing.
 * - `{ tappaId, azione: "concludi" }` closes both boards (BLVS-43), so the
 *   points stop being provisional, then publishes the standing.
 */
export async function POST(request: Request) {
  if (!isDemoSeedEnabled()) return notFound();
  const body = (await request.json().catch(() => ({}))) as {
    tappaId?: unknown;
    azione?: unknown;
  };
  if (body.tappaId === undefined) {
    return Response.json(creaScenarioClassificaDemo(), { status: 201 });
  }
  const tappaId = String(body.tappaId);
  const nome = nomeTappaDemo(tappaId);
  if (body.azione === "salva") {
    if (!salvaFinaleDemo(tappaId, "M")) return notFound();
    await pubblicaClassificaGenerale(tappaId, `${nome}: finale gold conclusa`);
    return Response.json({ ok: true });
  }
  if (body.azione === "concludi") {
    if (!concludiTabelloniDemo(tappaId)) return notFound();
    await pubblicaClassificaGenerale(tappaId, `${nome}: punti definitivi`);
    return Response.json({ ok: true });
  }
  return invalid({ azione: "Usa «salva» o «concludi»." });
}
