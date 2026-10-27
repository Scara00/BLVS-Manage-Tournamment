import "server-only";
import { notFound, readJsonObject } from "@/lib/api/responses";
import { isDemoSeedEnabled } from "./gestione-tappe-route";
import { creaDemoRitiro } from "./ritiri";

/**
 * BLVS-42: a stage in progress whose men's board is started; answers
 * `{ id, categoria: "m", gironeId }`. Body `{ faseSuccessiva?: true }`
 * adds a generated next phase with one scored final.
 */
export async function creaDemoRitiroRoute(request: Request): Promise<Response> {
  if (!isDemoSeedEnabled()) return notFound();
  const body = (await readJsonObject(request)) ?? {};
  const { id, gironeId } = creaDemoRitiro(body.faseSuccessiva === true);
  return Response.json({ id, categoria: "m", gironeId }, { status: 201 });
}
