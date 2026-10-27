import "server-only";
import { notFound, readJsonObject } from "@/lib/api/responses";
import type { SetPunteggio } from "@/lib/db/types";
import { proponiGoldSilver } from "@/lib/gironi/fasi/qualificazione";
import { datiDemoProssimaFase } from "@/lib/gironi/fasi/read";
import {
  avviaFaseDemo,
  creaDemoTappaGironi,
  getDemoFaseTabellone,
  proponiGoldSilverDemo,
} from "./avvio-fase";
import { isDemoSeedEnabled } from "./gestione-tappe-route";
import { classificaDemo, impostaPunteggioDemo } from "./punteggi";
import { salvaDemoDecisione } from "./spareggi";

/** One set per round: A always wins, by margins that leave no tie. */
const SENZA_PARITA: SetPunteggio[] = [
  { a: 21, b: 10 },
  { a: 21, b: 12 },
  { a: 21, b: 14 },
];
/** A wins every round 21-19: B, C and D end in a perfect tie. */
const CON_PARITA: SetPunteggio[] = [
  { a: 21, b: 19 },
  { a: 21, b: 19 },
  { a: 21, b: 19 },
];

/** Concludes every match of the M board's groups in play. */
function concludi(tappaId: string, parita: boolean) {
  const board = getDemoFaseTabellone(tappaId, "M");
  board?.gironi.forEach((girone, i) => {
    const sets = parita && i === 0 ? CON_PARITA : SENZA_PARITA;
    sets.forEach((set, t) =>
      impostaPunteggioDemo(`${girone.id}-t${t + 1}`, set),
    );
  });
}

/** Resolves every open tie of the groups in play, in registration order. */
function risolvi(tappaId: string) {
  for (const girone of getDemoFaseTabellone(tappaId, "M")?.gironi ?? []) {
    for (const p of classificaDemo(tappaId, girone.id)?.parita ?? []) {
      salvaDemoDecisione(girone.id, {
        firma: p.firma,
        ordine: [...p.iscrizioni].sort(),
      });
    }
  }
}

export const SCENARI_FASI = [
  "iniziali_concluse",
  "parita",
  "gold_silver_concluse",
] as const;
type ScenarioFasi = (typeof SCENARI_FASI)[number];

function crea(scenario: ScenarioFasi): string {
  const id = creaDemoTappaGironi([4, 4, 4, 4]);
  avviaFaseDemo(id, "M");
  concludi(id, scenario === "parita");
  if (scenario === "gold_silver_concluse") {
    const dati = datiDemoProssimaFase(id, "M");
    const esito = dati ? proponiGoldSilver(dati.gironi) : null;
    if (esito?.esito === "ok") {
      proponiGoldSilverDemo(
        id,
        "M",
        esito.gironi.map((g) => ({
          fase: g.fase,
          nome: g.nome,
          iscrizioni: g.giocatori.map((p) => p.iscrizioneId),
        })),
      );
      avviaFaseDemo(id, "M");
      concludi(id, false);
    }
  }
  return id;
}

/**
 * BLVS-39 e2e fixture. `{scenario}` creates a stage in progress whose M
 * board has 4 initial groups: all concluded, with a tie in Girone A, or
 * further on with the gold/silver groups concluded; answers `{ id }`.
 * `{tappaId, risolvi: true}` resolves the open ties of that board, as the
 * admin would (BLVS-38).
 */
export async function demoFasiRoute(request: Request): Promise<Response> {
  if (!isDemoSeedEnabled()) return notFound();
  const body = (await readJsonObject(request)) ?? {};
  if (typeof body.tappaId === "string" && body.risolvi === true) {
    risolvi(body.tappaId);
    return Response.json({ ok: true });
  }
  const scenario: ScenarioFasi = (SCENARI_FASI as readonly unknown[]).includes(
    body.scenario,
  )
    ? (body.scenario as ScenarioFasi)
    : "iniziali_concluse";
  return Response.json({ id: crea(scenario) }, { status: 201 });
}
