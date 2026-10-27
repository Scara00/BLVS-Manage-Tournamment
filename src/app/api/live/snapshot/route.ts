import { readLiveSync } from "@/lib/live/read";

/** Full current state: the client's resync after (re)connecting. */
export async function GET() {
  return Response.json(await readLiveSync(), {
    headers: { "Cache-Control": "no-store" },
  });
}
