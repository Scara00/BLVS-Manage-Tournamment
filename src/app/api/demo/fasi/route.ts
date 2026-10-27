import { demoFasiRoute } from "@/lib/demo/fasi-route";

/** POST /api/demo/fasi — e2e fixture, 404 unless TAPPE_DEMO_SEED=true. */
export async function POST(request: Request) {
  return demoFasiRoute(request);
}
