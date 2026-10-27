import { creaDemoTappaRoute } from "@/lib/demo/gestione-tappe-route";

/** POST /api/demo/tappe — e2e fixture, 404 unless TAPPE_DEMO_SEED=true. */
export async function POST(request: Request) {
  return creaDemoTappaRoute(request);
}
