import "server-only";
import { notFound, readJsonObject } from "@/lib/api/responses";
import { isUuid } from "@/lib/api/validation";
import { leggiSets } from "@/lib/punteggi/coda/validation";
import {
  creaDemoPartitaPunteggio,
  leggiDemoPartitaPunteggio,
  modificaDemoPartitaPunteggio,
} from "./coda-punteggi";
import { isDemoSeedEnabled } from "./gestione-tappe-route";

/**
 * e2e fixture for the score queue. Body `{}` creates a match (201
 * `{ partitaId, versione }`); `{ partitaId, sets }` saves as another admin
 * would (200 `{ sets, versione }`), to provoke a conflict.
 */
export async function demoPunteggiPost(request: Request): Promise<Response> {
  if (!isDemoSeedEnabled()) return notFound();
  const body = (await readJsonObject(request)) ?? {};
  if (body.partitaId === undefined)
    return Response.json(creaDemoPartitaPunteggio(), { status: 201 });
  const sets = leggiSets(body.sets);
  if (typeof body.partitaId !== "string" || !isUuid(body.partitaId) || !sets)
    return notFound();
  const salvato = modificaDemoPartitaPunteggio(body.partitaId, sets);
  return salvato ? Response.json(salvato) : notFound();
}

/** `?partita=<id>` → `{ sets, versione, scritture }` (writes, for «invio unico»). */
export function demoPunteggiGet(request: Request): Response {
  if (!isDemoSeedEnabled()) return notFound();
  const id = new URL(request.url).searchParams.get("partita") ?? "";
  const partita = leggiDemoPartitaPunteggio(id);
  return partita ? Response.json(partita) : notFound();
}
