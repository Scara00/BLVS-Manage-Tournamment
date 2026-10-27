import "server-only";
import { notFound, readJsonObject } from "@/lib/api/responses";
import {
  avviaFaseDemo,
  creaDemoAvvioFase,
  SCENARI_AVVIO,
  type ScenarioAvvio,
} from "./avvio-fase";
import { isDemoSeedEnabled } from "./gestione-tappe-route";

/**
 * Creates a stage with composed groups for one e2e test; answers `{ id }`.
 * `avviata: true` (BLVS-31) also starts the M board's phase.
 */
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
  const id = creaDemoAvvioFase(scenario);
  if (body.avviata === true) avviaFaseDemo(id, "M");
  return Response.json({ id }, { status: 201 });
}
