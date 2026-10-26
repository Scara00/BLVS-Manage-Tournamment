import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import {
  colorEntries,
  type ColorTokenEntry,
} from "@/lib/design-tokens/css-vars";
import {
  contrastRatio,
  formatRatio,
  THRESHOLDS,
} from "@/lib/design-tokens/contrast";
import { color, contrastPairs } from "@/lib/design-tokens/tokens";
import { DocPage, DocSection } from "./doc-page";

const GROUPS: {
  id: string;
  title: string;
  description: string;
  match: (path: string) => boolean;
}[] = [
  {
    id: "colori-brand",
    title: "Brand",
    description:
      "Nero e giallo tape dal sito beachlifevolleysoul.it. Il tape è solo superficie o decorazione: su bianco non raggiunge mai il contrasto del testo.",
    match: (p) =>
      [
        "primary",
        "primaryForeground",
        "tape",
        "tapeStrong",
        "tapeSoft",
        "accent",
      ].includes(p),
  },
  {
    id: "colori-neutri",
    title: "Neutri",
    description: "Scala di grigi derivata dai neutri del sito.",
    match: (p) => p.startsWith("neutral."),
  },
  {
    id: "colori-semantici",
    title: "Semantici",
    description:
      "Ruoli dell'interfaccia: sfondo, testo, bordi e anello di focus.",
    match: (p) =>
      [
        "background",
        "foreground",
        "mutedForeground",
        "border",
        "input",
        "ring",
      ].includes(p),
  },
  {
    id: "colori-funzionali",
    title: "Funzionali",
    description:
      "Coppie testo/sfondo per esiti e stati. Live va sempre accompagnato dall'etichetta “LIVE”.",
    match: (p) => /^(success|error|warning|info|live)\./.test(p),
  },
  {
    id: "colori-iscrizioni",
    title: "Iscrizioni",
    description: "Badge degli stati di iscrizione a un torneo.",
    match: (p) => p.startsWith("reg."),
  },
];

function Swatch({ entry }: { entry: ColorTokenEntry }) {
  const onWhite = contrastRatio(entry.value, color.neutral[0]);
  const onBlack = contrastRatio(entry.value, color.neutral[900]);
  return (
    <li className="flex flex-col border border-border bg-card">
      <div
        aria-hidden
        className="h-space-8 border-b border-border"
        style={{ backgroundColor: `var(${entry.cssVar})` }}
      />
      <dl className="grid grid-cols-[auto_1fr] gap-x-space-2 gap-y-space-1 p-inset-sm text-xs">
        <dt className="sr-only">Token</dt>
        <dd className="col-span-2 font-mono text-sm font-semibold text-foreground">
          {entry.path}
        </dd>
        <dt className="sr-only">Variabile CSS</dt>
        <dd className="col-span-2 mb-space-1 font-mono text-muted-foreground">
          {entry.cssVar}
        </dd>
        <dt className="text-muted-foreground">Hex</dt>
        <dd className="font-mono">{entry.value}</dd>
        <dt className="text-muted-foreground">Su bianco</dt>
        <dd className="font-mono">{formatRatio(onWhite)}</dd>
        <dt className="text-muted-foreground">Su nero</dt>
        <dd className="font-mono">{formatRatio(onBlack)}</dd>
      </dl>
    </li>
  );
}

function SwatchGrid({ entries }: { entries: ColorTokenEntry[] }) {
  return (
    <ul className="grid grid-cols-2 gap-space-3 sm:grid-cols-3 lg:grid-cols-5">
      {entries.map((entry) => (
        <Swatch key={entry.path} entry={entry} />
      ))}
    </ul>
  );
}

const KIND_LABEL = {
  score: "Punteggi (AAA)",
  text: "Testo (AA)",
  graphic: "Grafica (1.4.11)",
} as const;

function PairsTable() {
  return (
    <div
      role="region"
      aria-labelledby="coppie-caption"
      tabIndex={0}
      className="overflow-x-auto border border-border focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
    >
      <table className="w-full min-w-[40rem] border-collapse text-left text-sm">
        <caption id="coppie-caption" className="sr-only">
          Coppie colore dichiarate con rapporto di contrasto e soglia
        </caption>
        <thead className="bg-muted">
          <tr>
            <th scope="col" className="p-space-3 font-semibold">
              Coppia
            </th>
            <th scope="col" className="p-space-3 font-semibold">
              Esempio
            </th>
            <th scope="col" className="p-space-3 font-semibold">
              Testo / sfondo
            </th>
            <th scope="col" className="p-space-3 text-right font-semibold">
              Rapporto
            </th>
            <th scope="col" className="p-space-3 font-semibold">
              Soglia
            </th>
            <th scope="col" className="p-space-3 font-semibold">
              Esito
            </th>
          </tr>
        </thead>
        <tbody>
          {contrastPairs.map((pair) => {
            const ratio = contrastRatio(pair.fg, pair.bg);
            const min = THRESHOLDS[pair.kind];
            const pass = ratio >= min;
            return (
              <tr key={pair.name} className="border-t border-border">
                <th scope="row" className="p-space-3 font-medium">
                  {pair.name}
                </th>
                <td className="p-space-3">
                  {pair.kind === "graphic" ? (
                    <span
                      aria-hidden
                      className="inline-block size-space-6 border-4"
                      style={{ borderColor: pair.fg, backgroundColor: pair.bg }}
                    />
                  ) : (
                    <span
                      className="inline-block px-space-2 py-space-1 font-mono font-semibold"
                      style={{ color: pair.fg, backgroundColor: pair.bg }}
                    >
                      21–19
                    </span>
                  )}
                </td>
                <td className="p-space-3 font-mono text-xs">
                  {pair.fg} / {pair.bg}
                </td>
                <td className="p-space-3 text-right font-mono">
                  {formatRatio(ratio)}
                </td>
                <td className="p-space-3">
                  {KIND_LABEL[pair.kind]} ≥ {min}:1
                </td>
                <td className="p-space-3">
                  <span
                    className={
                      pass
                        ? "bg-success-bg px-space-2 py-space-1 font-semibold text-success-fg"
                        : "bg-error-bg px-space-2 py-space-1 font-semibold text-error-fg"
                    }
                  >
                    {pass ? "Superata" : "Non superata"}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function ColoriPage() {
  return (
    <DocPage
      title="Colori"
      intro="Ogni colore esiste come costante TypeScript in @/lib/design-tokens e come variabile CSS in globals.css. I rapporti di contrasto sono calcolati con la formula WCAG 2.x."
    >
      {GROUPS.map((group) => (
        <DocSection
          key={group.id}
          id={group.id}
          title={group.title}
          description={group.description}
        >
          <SwatchGrid
            entries={colorEntries.filter((e) => group.match(e.path))}
          />
        </DocSection>
      ))}
      <DocSection
        id="coppie-dichiarate"
        title="Coppie dichiarate"
        description="Le sole combinazioni testo/sfondo ammesse. Il test tokens:contrast fallisce se una coppia scende sotto la soglia."
      >
        <PairsTable />
      </DocSection>
    </DocPage>
  );
}

const meta = {
  title: "Design system/Colori",
  component: ColoriPage,
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof ColoriPage>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Colori: Story = {};
