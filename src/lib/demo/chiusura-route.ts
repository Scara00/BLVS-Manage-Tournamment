import "server-only";
import { notFound, readJsonObject } from "@/lib/api/responses";
import {
  creaDemoChiusura,
  SCENARI_CHIUSURA,
  type ScenarioChiusura,
} from "./chiusura";
import { isDemoSeedEnabled } from "./gestione-tappe-route";

/**
 * `POST /api/demo/chiusura-tabellone {scenario}` (TAPPE_DEMO_SEED): a
 * stage whose two boards are in the finals; answers `{ id }`.
 */
export async function demoChiusuraRoute(request: Request): Promise<Response> {
  if (!isDemoSeedEnabled()) return notFound();
  const body = (await readJsonObject(request)) ?? {};
  const scenario: ScenarioChiusura = (
    SCENARI_CHIUSURA as readonly unknown[]
  ).includes(body.scenario)
    ? (body.scenario as ScenarioChiusura)
    : "finali_concluse";
  return Response.json({ id: creaDemoChiusura(scenario) }, { status: 201 });
}
