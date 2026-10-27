import { creaDemoRigenerazioneRoute } from "@/lib/demo/rigenera-gironi-route";

/** POST /api/demo/rigenera-gironi — e2e fixture, 404 unless TAPPE_DEMO_SEED=true. */
export async function POST(request: Request) {
  return creaDemoRigenerazioneRoute(request);
}
