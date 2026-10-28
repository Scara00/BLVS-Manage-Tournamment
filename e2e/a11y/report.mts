/**
 * BLVS-56 · Writes the measured parts of docs/a11y-report.md from the
 * Playwright JSON report of e2e/a11y.spec.ts + e2e/storybook-schermate.spec.ts:
 * - the measured-values table, between `<!-- misure:inizio -->` and
 *   `<!-- misure:fine -->`;
 * - one checklist per screen, between `<!-- schermate:inizio -->` and
 *   `<!-- schermate:fine -->`.
 *
 *   npm run test:a11y      # writes test-results/a11y.json
 *   npm run a11y:report    # updates the report
 *
 * Plain Node (type stripping): no imports from the app or the specs.
 */
import { readFileSync, writeFileSync } from "node:fs";

type Target = { nome: string; larghezza: number; altezza: number };
type Misura = {
  schermata: string;
  vista: string;
  sorgente: string;
  targetMinimo: Target | null;
  targetSottoSoglia: (Target & { selettore: string })[];
  sogliaTarget: number;
  contrastoMinimo: number | null;
  contrastoSottoSoglia: { selettore: string; rapporto: number }[];
  scrollOrizzontale: boolean;
  tastiera?: {
    fermate: number;
    senzaIndicatore: string[];
    oscurati: string[];
  };
  zoom200?: { scrollOrizzontale: boolean };
  zoom400?: { scrollOrizzontale: boolean };
  testo200?: { scrollOrizzontale: boolean };
};
type Voce = {
  id: string;
  titolo: string;
  area: string;
  bordoCampo: boolean;
  storie: string[];
  app: boolean;
  inAttesa: string | null;
  disattiva: { regola: string; motivo: string }[];
};
type Result = {
  status: string;
  errors?: { message?: string }[];
  attachments?: { name: string; body?: string }[];
};
type Spec = {
  title: string;
  tests: { projectName: string; results: Result[] }[];
};
type Suite = { specs?: Spec[]; suites?: Suite[] };

const [input = "test-results/a11y.json", output = "docs/a11y-report.md"] =
  process.argv.slice(2);

const report = JSON.parse(readFileSync(input, "utf8")) as { suites: Suite[] };
const misure: Misura[] = [];
let inventario: Voce[] = [];
/** Screen id → test outcomes (one per project). */
const esiti = new Map<string, string[]>();
/** Screen id → first line of each failure, to show in the notes. */
const errori = new Map<string, string[]>();

const decode = (body: string) => Buffer.from(body, "base64").toString("utf8");

function visit(suite: Suite) {
  for (const spec of suite.specs ?? []) {
    const id = spec.title.split(" · ")[0];
    for (const t of spec.tests) {
      const last = t.results.at(-1);
      if (!last) continue;
      if (id.startsWith("w-")) {
        esiti.set(id, [...(esiti.get(id) ?? []), last.status]);
        for (const e of last.errors ?? []) {
          const line = (e.message ?? "")
            .replace(/\x1b\[[0-9;]*m/g, "")
            .split("\n")[0];
          errori.set(id, [
            ...(errori.get(id) ?? []),
            `${t.projectName}: ${line}`,
          ]);
        }
      }
      for (const a of last.attachments ?? []) {
        if (!a.body) continue;
        if (a.name === "inventario") inventario = JSON.parse(decode(a.body));
        if (a.name.startsWith("misure-"))
          misure.push(JSON.parse(decode(a.body)));
      }
    }
  }
  suite.suites?.forEach(visit);
}
report.suites.forEach(visit);
if (inventario.length === 0) throw new Error(`Inventario assente in ${input}`);

const perSchermata = new Map<string, Misura[]>();
for (const m of misure) {
  perSchermata.set(m.schermata, [...(perSchermata.get(m.schermata) ?? []), m]);
}

const lato = (t: Target) => Math.min(t.larghezza, t.altezza);
const ratio = (r: number) => `${(Math.floor(r * 100) / 100).toFixed(2)}:1`;
const viste = (m: Misura[]) =>
  [...new Set(m.map((x) => x.vista))]
    .sort((a, b) => Number(a) - Number(b))
    .join(" e ");
const targetMinimo = (m: Misura[]) => {
  const t = m.map((x) => x.targetMinimo).filter((x): x is Target => x !== null);
  return t.length ? t.reduce((a, b) => (lato(b) < lato(a) ? b : a)) : null;
};
const fmtTarget = (t: Target | null) =>
  t ? `${t.larghezza}×${t.altezza} («${t.nome || "senza testo"}»)` : "n/d";
const contrastoMinimo = (m: Misura[]) => {
  const c = m
    .map((x) => x.contrastoMinimo)
    .filter((x): x is number => x !== null);
  return c.length ? Math.min(...c) : null;
};
const axeOk = (id: string) => {
  const s = esiti.get(id) ?? [];
  return s.length > 0 && s.every((x) => x === "passed");
};
const OK = "✅ Conforme";
const KO = "❌ Non conforme";
const ND = "— Non applicabile";

// ── Measured values ─────────────────────────────────────────────────────
const righeMisure = inventario.map((v) => {
  const m = perSchermata.get(v.id) ?? [];
  if (v.inAttesa) return `| ${v.id} | — | ⏳ ${v.inAttesa} | — | — | — |`;
  const c = contrastoMinimo(m);
  return `| ${v.id} | ${viste(m) || "—"} | ${axeOk(v.id) ? "✅" : "❌"} | ≥${v.bordoCampo ? 48 : 24} | ${fmtTarget(targetMinimo(m))} | ${c === null ? "n/d (nessun punteggio)" : ratio(c)} |`;
});
const tabellaMisure = [
  `Generato da \`npm run a11y:report\` il ${new Date().toISOString().slice(0, 10)} da ${misure.length} misurazioni.`,
  "«Target più piccolo» = il controllo con il lato minore (sulle schermate a bordo campo, solo nel contenuto). «n/d» = nessun elemento di quel tipo.",
  "",
  "| Schermata | Larghezze (px) | Suite e2e | Soglia target (px) | Target più piccolo (px) | Contrasto minimo punteggi, posizioni e Live (≥ 7:1) |",
  "| --- | --- | --- | --- | --- | --- |",
  ...righeMisure,
].join("\n");

// ── Per-screen checklists ───────────────────────────────────────────────
function checklist(v: Voce): string {
  const titolo = `### ${v.id} · ${v.titolo}`;
  const area = `Area: ${v.area}${v.bordoCampo ? " · **controlli a bordo campo** (≥ 48×48 px)" : ""}.`;
  if (v.inAttesa) {
    return [
      titolo,
      "",
      area,
      `**Non verificata: ${v.inAttesa}.** La schermata entra nella suite (\`e2e/a11y/schermate.ts\`) e in questo report quando la dipendenza è su main. Vedi la sezione «Non conformità e verifiche aperte».`,
    ].join("\n");
  }
  const m = perSchermata.get(v.id) ?? [];
  const desktop = m.filter((x) => x.tastiera);
  const sorgenti = [...new Set(m.map((x) => x.sorgente))]
    .map((s) => s.replace(/e2e-[0-9a-f-]{36}/g, "<tappa demo>"))
    .filter((s, i, all) => all.indexOf(s) === i)
    .map((s) => `\`${s}\``)
    .join(", ");
  const sotto = m.flatMap((x) => x.targetSottoSoglia);
  const c = contrastoMinimo(m);
  const cSotto = m.flatMap((x) => x.contrastoSottoSoglia);
  const tastiera = desktop.map((x) => x.tastiera!);
  const noIndicatore = tastiera.flatMap((t) => t.senzaIndicatore);
  const oscurati = tastiera.flatMap((t) => t.oscurati);
  const fermate = tastiera.map((t) => t.fermate);
  const scroll390 = m
    .filter((x) => x.vista === "390")
    .some((x) => x.scrollOrizzontale);
  const z200 = desktop.some((x) => x.zoom200?.scrollOrizzontale);
  const z400 = desktop.some((x) => x.zoom400?.scrollOrizzontale);
  const t200 = m.some((x) => x.testo200?.scrollOrizzontale);
  // App screens: user font size 200% at 390 px; stories: the Testo200 story.
  const t200Misurato =
    m.some((x) => x.testo200) || v.storie.some((s) => /testo-?200/.test(s));
  const err = [...new Set(errori.get(v.id) ?? [])];
  const axe = axeOk(v.id);
  const elenco = (xs: string[]) => [...new Set(xs)].slice(0, 4).join("; ");

  const righe: [string, string, string, string][] = [
    [
      "1.1.1, 1.3.1, 1.4.1, 2.4.2, 2.4.4, 3.1.1, 3.3.2, 4.1.2 (regole automatiche A/AA)",
      axe ? OK : KO,
      "axe-core 4.14 a 390 e 1440 px",
      axe ? "Nessuna violazione WCAG 2.0, 2.1 e 2.2 A/AA." : elenco(err),
    ],
    [
      "1.4.3 Contrasto (minimo)",
      axe ? OK : KO,
      "axe-core (`color-contrast`)",
      "≥ 4,5:1 testo, ≥ 3:1 testo grande.",
    ],
    [
      "R-67 Contrasto ≥ 7:1 di punteggi, posizioni e Live",
      c === null ? ND : cSotto.length ? KO : OK,
      "axe-core `color-contrast-enhanced` sugli elementi del tabellone",
      c === null
        ? "Nessun punteggio, posizione o Live sulla schermata."
        : cSotto.length
          ? `Minimo ${ratio(c)}: ${elenco(cSotto.map((x) => `${x.selettore} ${ratio(x.rapporto)}`))}`
          : `Minimo misurato ${ratio(c)}.`,
    ],
    [
      v.bordoCampo
        ? "2.5.8 Dimensione del target + R-66 (≥ 48×48 px a bordo campo)"
        : "2.5.8 Dimensione del target (minimo, ≥ 24×24 px)",
      sotto.length ? KO : OK,
      "misura dei riquadri (Playwright), 390 e 1440 px",
      sotto.length
        ? `Sotto soglia: ${elenco(sotto.map((t) => `«${t.nome || t.selettore}» ${t.larghezza}×${t.altezza}`))}`
        : v.bordoCampo
          ? `Target più piccolo nel contenuto ${fmtTarget(targetMinimo(m))}; nessuna eccezione a bordo campo.`
          : `Target più piccolo ${fmtTarget(targetMinimo(m))}. Esenti i link nel testo (2.5.8 «inline»); eccezione della spaziatura applicata.`,
    ],
    [
      "1.3.4 Orientamento · 1.4.10 Ridisposizione a 390 px",
      scroll390 ? KO : OK,
      "larghezza 390 px",
      scroll390
        ? "Scroll orizzontale a 390 px."
        : "Nessuno scroll orizzontale.",
    ],
    [
      "1.4.4 Ridimensionamento del testo (testo al 200%)",
      t200
        ? KO
        : t200Misurato
          ? OK
          : "— Coperto dalle storie Testo200 dei componenti",
      v.app
        ? "dimensione del testo 200% a 390 px"
        : "storia «Testo200» a 390 e 1440 px",
      t200
        ? "Scroll orizzontale con il testo al 200%."
        : "Il testo va a capo, nessuno scroll orizzontale.",
    ],
    [
      "1.4.4 Ridimensionamento del testo (zoom 200%)",
      desktop.length === 0 ? "⏳ Non misurato" : z200 ? KO : OK,
      "zoom 200% (1440 px → 720 px CSS)",
      z200
        ? "Scroll orizzontale a zoom 200%."
        : "Nessuna perdita di contenuto né scroll orizzontale.",
    ],
    [
      "1.4.10 Ridisposizione (zoom 400%)",
      desktop.length === 0 ? "⏳ Non misurato" : z400 ? KO : OK,
      "zoom 400% (320 px CSS)",
      z400
        ? "Scroll orizzontale a 320 px."
        : "Contenuto su una colonna, nessuno scroll orizzontale.",
    ],
    [
      "2.1.1 Tastiera · 2.1.2 Nessun blocco",
      desktop.length === 0
        ? "⏳ Non misurato"
        : fermate.every((f) => f > 0)
          ? OK
          : KO,
      "tastiera (Tab, giro completo)",
      fermate.length
        ? `${Math.max(...fermate)} elementi raggiunti con Tab; nessuna trappola.`
        : "",
    ],
    [
      "2.4.7 Focus visibile",
      desktop.length === 0 ? "⏳ Non misurato" : noIndicatore.length ? KO : OK,
      "tastiera: outline o anello su ogni fermata",
      noIndicatore.length
        ? `Senza indicatore: ${elenco(noIndicatore)}`
        : "Indicatore su ogni elemento.",
    ],
    [
      "2.4.11 Focus non oscurato (minimo)",
      desktop.length === 0 ? "⏳ Non misurato" : oscurati.length ? KO : OK,
      "tastiera: punto del focus non coperto (header fisso, overlay)",
      oscurati.length
        ? `Coperti: ${elenco(oscurati)}`
        : "Nessun elemento coperto.",
    ],
    [
      "1.3.1, 4.1.2, 4.1.3 con lettore di schermo",
      "⏳ Da eseguire",
      "NVDA (Windows, Firefox/Chrome)",
      "Verifica manuale non ancora eseguita: vedi «Non conformità e verifiche aperte», A11Y-01.",
    ],
    [
      "1.3.1, 4.1.2, 4.1.3 con lettore di schermo",
      "⏳ Da eseguire",
      "VoiceOver (macOS Safari, iOS Safari)",
      "Verifica manuale non ancora eseguita: vedi A11Y-01.",
    ],
  ];
  const regole = v.disattiva.length
    ? `Regole axe disattivate: ${v.disattiva.map((r) => `\`${r.regola}\` (${r.motivo})`).join("; ")}.`
    : "Regole axe disattivate: nessuna.";
  return [
    titolo,
    "",
    `${area} Verificata su ${sorgenti || "—"}. ${regole}`,
    "",
    "| Criterio | Esito | Strumento | Note |",
    "| --- | --- | --- | --- |",
    ...righe.map(
      (r) => `| ${r.map((x) => x.replace(/\|/g, "\\|")).join(" | ")} |`,
    ),
  ].join("\n");
}

const aree = [
  ["pubblica", "Accesso e pagine pubbliche"],
  ["giocatore", "Giocatore"],
  ["admin", "Amministrazione"],
] as const;
const sezioni = aree
  .map(([area, nome]) =>
    [
      `### ${nome}`.replace("###", "###"),
      "",
      ...inventario
        .filter((v) => v.area === area)
        .map((v) => checklist(v).replace(/^### /, "#### ")),
    ].join("\n\n"),
  )
  .join("\n\n");

function sostituisci(doc: string, nome: string, contenuto: string) {
  const inizio = `<!-- ${nome}:inizio -->`;
  const fine = `<!-- ${nome}:fine -->`;
  const a = doc.indexOf(inizio);
  const b = doc.indexOf(fine);
  if (a < 0 || b < a)
    throw new Error(`Marcatori ${inizio}/${fine} assenti in ${output}`);
  return `${doc.slice(0, a + inizio.length)}\n\n${contenuto}\n\n${doc.slice(b)}`;
}

let doc = readFileSync(output, "utf8");
doc = sostituisci(doc, "misure", tabellaMisure);
doc = sostituisci(doc, "schermate", sezioni);
writeFileSync(output, doc);
console.log(
  `${output}: ${inventario.length} schermate, ${misure.length} misurazioni, ${[...esiti.values()].flat().filter((s) => s !== "passed").length} esiti non riusciti.`,
);
