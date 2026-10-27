import "server-only";
import { notFound, readJsonObject } from "@/lib/api/responses";
import { isDemoSeedEnabled } from "./gestione-tappe-route";
import { creaDemoCorrezione, creaDemoPunteggi } from "./punteggi";

/** Creates a stage in progress with group matches to score; answers `{ id }`. */
export async function creaDemoPunteggiRoute(): Promise<Response> {
  if (!isDemoSeedEnabled()) return notFound();
  return Response.json({ id: creaDemoPunteggi() }, { status: 201 });
}

/**
 * BLVS-41: a stage whose men's groups are all scored and whose next phase
 * (two finals) is generated; answers `{ id }`. Body: `{ punteggi?: 0..2 }`,
 * how many finals already have a score.
 */
export async function creaDemoCorrezioneRoute(
  request: Request,
): Promise<Response> {
  if (!isDemoSeedEnabled()) return notFound();
  const body = (await readJsonObject(request)) ?? {};
  const punteggi =
    Number.isInteger(body.punteggi) &&
    (body.punteggi as number) >= 0 &&
    (body.punteggi as number) <= 2
      ? (body.punteggi as number)
      : 1;
  return Response.json({ id: creaDemoCorrezione(punteggi) }, { status: 201 });
}
