import { demoChiusuraRoute } from "@/lib/demo/chiusura-route";

/** POST /api/demo/chiusura-tabellone — e2e fixture, 404 unless TAPPE_DEMO_SEED=true. */
export async function POST(request: Request) {
  return demoChiusuraRoute(request);
}
