import { creaDemoAvvioFaseRoute } from "@/lib/demo/avvio-fase-route";

/** POST /api/demo/avvio-fase — e2e fixture, 404 unless TAPPE_DEMO_SEED=true. */
export async function POST(request: Request) {
  return creaDemoAvvioFaseRoute(request);
}
