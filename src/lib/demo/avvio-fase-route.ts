import "server-only";
import { notFound, readJsonObject } from "@/lib/api/responses";
import {
  creaDemoAvvioFase,
  SCENARI_AVVIO,
  type ScenarioAvvio,
} from "./avvio-fase";
import { isDemoSeedEnabled } from "./gestione-tappe-route";

/** Creates a stage with composed groups for one e2e test; answers `{ id }`. */
export async function creaDemoAvvioFaseRoute(
  request: Request,
): Promise<Response> {
  if (!isDemoSeedEnabled()) return notFound();
  const body = (await readJsonObject(request)) ?? {};
  const scenario: ScenarioAvvio = (
    SCENARI_AVVIO as readonly unknown[]
  ).includes(body.scenario)
    ? (body.scenario as ScenarioAvvio)
    : "pronta";
  return Response.json({ id: creaDemoAvvioFase(scenario) }, { status: 201 });
}
