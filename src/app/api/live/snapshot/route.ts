import { readLiveSync } from "@/lib/live/read";
import { readLiveTappaSync } from "@/lib/live/tappa-read";

/**
 * Full current state: the client's resync after (re)connecting. With
 * `?tappa=<id>` only that stage's matches and groups (w-live, BLVS-36).
 */
export async function GET(request: Request) {
  const tappa = new URL(request.url).searchParams.get("tappa");
  const sync = tappa ? await readLiveTappaSync(tappa) : await readLiveSync();
  return Response.json(sync, {
    headers: { "Cache-Control": "no-store" },
  });
}
