import { creaDemoGironiRoute } from "@/lib/demo/gironi-editor-route";

/** POST /api/demo/gironi — e2e fixture, 404 unless TAPPE_DEMO_SEED=true. */
export async function POST(request: Request) {
  return creaDemoGironiRoute(request);
}
