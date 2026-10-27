import "server-only";
import { notFound, readJsonObject } from "@/lib/api/responses";
import { isDemoSeedEnabled } from "./gestione-tappe-route";
import {
  creaDemoCorrezione,
  creaDemoPartitaInCorso,
  creaDemoPunteggi,
} from "./punteggi";

/**
 * Creates a stage in progress with group matches to score; answers
 * `{ id }`. With `{ inCorso: true }` its first match is already started
 * (BLVS-37) and the answer is `{ id, partitaId }`.
 */
export async function creaDemoPunteggiRoute(
  request?: Request,
): Promise<Response> {
  if (!isDemoSeedEnabled()) return notFound();
  const body = (await request?.json().catch(() => null)) as {
    inCorso?: unknown;
  } | null;
  if (body?.inCorso === true) {
    return Response.json(creaDemoPartitaInCorso(), { status: 201 });
  }
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
