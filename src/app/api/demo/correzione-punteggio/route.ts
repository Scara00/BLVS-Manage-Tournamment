import { creaDemoCorrezioneRoute } from "@/lib/demo/punteggi-route";

/** POST /api/demo/correzione-punteggio — e2e fixture, 404 unless TAPPE_DEMO_SEED=true. */
export async function POST(request: Request) {
  return creaDemoCorrezioneRoute(request);
}
