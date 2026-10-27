import {
  parseIdClassifica,
  readClassificaGeneraleSync,
} from "@/lib/classifica-generale/read";
import { readLiveSync } from "@/lib/live/read";
import { readLiveTappaSync } from "@/lib/live/tappa-read";

/**
 * Full current state: the client's resync after (re)connecting. With
 * `?tappa=<id>` only that stage's matches and groups (w-live, BLVS-36).
 * With `?classifica=<M|F>:<season>` one overall standing recomputed now
 * (w-classifica, BLVS-44).
 */
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const tappa = params.get("tappa");
  const classifica = params.get("classifica");
  const id = classifica ? parseIdClassifica(classifica) : null;
  const sync = tappa
    ? await readLiveTappaSync(tappa)
    : id
      ? await readClassificaGeneraleSync(id.categoria, id.stagione)
      : await readLiveSync();
  return Response.json(sync, {
    headers: { "Cache-Control": "no-store" },
  });
}
