import { getLiveBus } from "@/lib/live/bus";
import { LIVE_EVENT_TYPES, type LiveEventPayload } from "@/lib/live/types";
import { readSupabaseEnv } from "@/lib/supabase/env";

/**
 * Demo/test-only stand-in for "a result was saved", until score entry
 * (BLVS-07) calls the `publish*` helpers itself. Enabled only when
 * `LIVE_DEMO_PUBLISH=true` and Supabase is not configured (e2e and local
 * demos), a 404 everywhere else: with real data anyone could push scores.
 */
export async function POST(request: Request) {
  if (process.env.LIVE_DEMO_PUBLISH !== "true" || readSupabaseEnv()) {
    return new Response(null, { status: 404 });
  }
  let payload: LiveEventPayload;
  try {
    payload = (await request.json()) as LiveEventPayload;
  } catch {
    return Response.json({ error: "JSON non valido" }, { status: 400 });
  }
  if (!LIVE_EVENT_TYPES.includes(payload?.type)) {
    return Response.json(
      { error: "Tipo di evento sconosciuto" },
      { status: 400 },
    );
  }
  const event = getLiveBus().publish(payload);
  return Response.json(event, { status: 201 });
}
