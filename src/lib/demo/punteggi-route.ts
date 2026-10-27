import "server-only";
import { notFound } from "@/lib/api/responses";
import { isDemoSeedEnabled } from "./gestione-tappe-route";
import { creaDemoPunteggi } from "./punteggi";

/** Creates a stage in progress with group matches to score; answers `{ id }`. */
export async function creaDemoPunteggiRoute(): Promise<Response> {
  if (!isDemoSeedEnabled()) return notFound();
  return Response.json({ id: creaDemoPunteggi() }, { status: 201 });
}
