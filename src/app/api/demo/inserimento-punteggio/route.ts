import { creaDemoPunteggiRoute } from "@/lib/demo/punteggi-route";

/** POST /api/demo/inserimento-punteggio — e2e fixture, 404 unless TAPPE_DEMO_SEED=true. */
export async function POST(request: Request) {
  return creaDemoPunteggiRoute(request);
}
