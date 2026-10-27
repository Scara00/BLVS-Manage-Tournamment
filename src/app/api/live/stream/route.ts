import { getLiveBus } from "@/lib/live/bus";
import { parseSeq } from "@/lib/live/sse";
import { createLiveStream, SSE_HEADERS } from "@/lib/live/stream";

/**
 * Push channel for scores and standings (Server-Sent Events). Reading the
 * request headers makes this handler run at request time.
 */
export async function GET(request: Request) {
  const lastSeq =
    parseSeq(request.headers.get("last-event-id")) ??
    parseSeq(new URL(request.url).searchParams.get("since"));
  const body = createLiveStream(getLiveBus(), lastSeq, request.signal);
  return new Response(body, { headers: SSE_HEADERS });
}
