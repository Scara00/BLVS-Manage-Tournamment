/*
 * BLVS-56 · Carico del canale live (R-68): 300 client collegati a
 * /api/live/stream ricevono ogni punteggio salvato con p95 < 5 s.
 *
 * Due scenari sullo stesso host k6 (stesso orologio, quindi nessuno scarto):
 * - `ascoltatori`: ASCOLTATORI client SSE aperti per tutta la prova;
 * - `scrittore`: un punteggio ogni INTERVALLO_S secondi su /api/live/publish
 *   (LIVE_DEMO_PUBLISH=true), che entra nel bus come un salvataggio reale
 *   (stesso `publish`, stesso relay tra istanze, stesso stream).
 *
 * Ogni punteggio porta `k6: {n, t}` (numero e ms di invio): ogni client
 * misura `live_latenza_ms` = ricezione − invio e conta i buchi nella
 * sequenza. Richiede k6 ≥ 1.0 con l'estensione SSE (`k6/x/sse`), che k6 2.x
 * scarica da solo. Istruzioni: tests/load/README.md.
 */
import { check, sleep } from "k6";
import exec from "k6/execution";
import http from "k6/http";
import { Counter, Rate, Trend } from "k6/metrics";
import sse from "k6/x/sse";

const BASE_URL = (__ENV.BASE_URL || "http://localhost:3100").replace(/\/$/, "");
const ASCOLTATORI = Number(__ENV.ASCOLTATORI || 300);
/** Tempo per collegare tutti i client prima del primo punteggio. */
const RAMPA_S = Number(__ENV.RAMPA_S || 30);
/** Durata della scrittura, a regime. */
const DURATA_S = Number(__ENV.DURATA_S || 120);
const INTERVALLO_S = Number(__ENV.INTERVALLO_S || 2);
/** I client restano collegati ancora un po' per ricevere l'ultimo evento. */
const CODA_S = 10;
const PARTITA = "k6-carico";

const latenza = new Trend("live_latenza_ms", true);
const latenzaServer = new Trend("live_latenza_da_salvataggio_ms", true);
const ricevuti = new Counter("live_eventi_ricevuti");
const persi = new Counter("live_eventi_persi");
const consegna = new Rate("live_consegna_completa");
const salvataggi = new Rate("live_salvataggio_ok");

export const options = {
  scenarios: {
    ascoltatori: {
      executor: "per-vu-iterations",
      exec: "ascolta",
      vus: ASCOLTATORI,
      iterations: 1,
      maxDuration: `${RAMPA_S + DURATA_S + CODA_S + 60}s`,
    },
    scrittore: {
      executor: "constant-arrival-rate",
      exec: "scrivi",
      startTime: `${RAMPA_S}s`,
      duration: `${DURATA_S}s`,
      rate: 1,
      timeUnit: `${INTERVALLO_S}s`,
      // Un solo scrittore: la sequenza `n` resta continua.
      preAllocatedVUs: 1,
      maxVUs: 1,
    },
  },
  thresholds: {
    // Criterio di accettazione: p95 sotto 5 s tra salvataggio e ricezione.
    live_latenza_ms: ["p(95)<5000"],
    // Ogni client riceve ogni punteggio, senza buchi.
    live_consegna_completa: ["rate>0.99"],
    live_salvataggio_ok: ["rate>0.99"],
  },
  summaryTrendStats: ["min", "med", "avg", "p(90)", "p(95)", "p(99)", "max"],
};

/** Un client SSE: resta collegato fino alla fine della prova. */
export function ascolta() {
  const fine = exec.scenario.startTime + (RAMPA_S + DURATA_S + CODA_S) * 1000;
  // Collegamenti distribuiti sulla rampa, non tutti nello stesso istante.
  const attesa =
    ((exec.vu.idInTest - 1) % ASCOLTATORI) *
    ((RAMPA_S * 1000 * 0.8) / ASCOLTATORI);
  const visti = [];
  sleep(attesa / 1000);

  const res = sse.open(
    `${BASE_URL}/api/live/stream`,
    { headers: { Accept: "text/event-stream" }, tags: { nome: "stream" } },
    (client) => {
      client.on("event", (event) => {
        if (Date.now() > fine) {
          client.close();
          return;
        }
        if (event.name !== "score") return;
        const dati = JSON.parse(event.data);
        const k6 = dati.match && dati.match.k6;
        if (!k6 || dati.match.id !== PARTITA) return;
        const adesso = Date.now();
        latenza.add(adesso - k6.t);
        latenzaServer.add(adesso - Date.parse(dati.savedAt));
        ricevuti.add(1);
        visti.push(k6.n);
      });
      client.on("error", (e) => console.error(`stream: ${e.error()}`));
    },
  );

  check(res, { "stream aperto (200)": (r) => r && r.status === 200 });
  // Buchi nella sequenza ricevuta = eventi persi da questo client.
  let buchi = 0;
  for (let i = 1; i < visti.length; i++)
    buchi += Math.max(0, visti[i] - visti[i - 1] - 1);
  persi.add(buchi);
  consegna.add(visti.length > 0 && buchi === 0);
}

let numero = 0;

/** Salva un punteggio: lo stesso evento `score` di un salvataggio admin. */
export function scrivi() {
  numero += 1;
  const n = numero;
  const t = Date.now();
  const res = http.post(
    `${BASE_URL}/api/live/publish`,
    JSON.stringify({
      type: "score",
      match: {
        id: PARTITA,
        court: "Campo 1",
        groupId: PARTITA,
        groupLabel: "Prova di carico",
        home: "Squadra A",
        away: "Squadra B",
        sets: [[21, n % 20]],
        stageId: PARTITA,
        state: "conclusa",
        k6: { n, t },
      },
    }),
    {
      headers: { "Content-Type": "application/json" },
      tags: { nome: "publish" },
    },
  );
  salvataggi.add(res.status === 201);
}

export function handleSummary(data) {
  const out = __ENV.RISULTATI || "tests/load/risultati/live-p95.json";
  return {
    [out]: JSON.stringify(data, null, 2),
    stdout: `\n${JSON.stringify(
      {
        ascoltatori: ASCOLTATORI,
        p95_ms:
          data.metrics.live_latenza_ms &&
          data.metrics.live_latenza_ms.values["p(95)"],
        soglie: Object.fromEntries(
          Object.entries(data.metrics)
            .filter(([, m]) => m.thresholds)
            .map(([k, m]) => [
              k,
              Object.values(m.thresholds).every((t) => t.ok),
            ]),
        ),
      },
      null,
      2,
    )}\n`,
  };
}
