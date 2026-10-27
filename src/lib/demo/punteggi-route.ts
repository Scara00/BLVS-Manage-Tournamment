import "server-only";
import { notFound } from "@/lib/api/responses";
import { isDemoSeedEnabled } from "./gestione-tappe-route";
import { creaDemoPartitaInCorso, creaDemoPunteggi } from "./punteggi";

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
