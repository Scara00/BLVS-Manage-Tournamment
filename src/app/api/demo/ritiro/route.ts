import { creaDemoRitiroRoute } from "@/lib/demo/ritiri-route";

/** POST /api/demo/ritiro — e2e fixture, 404 unless TAPPE_DEMO_SEED=true. */
export async function POST(request: Request) {
  return creaDemoRitiroRoute(request);
}
