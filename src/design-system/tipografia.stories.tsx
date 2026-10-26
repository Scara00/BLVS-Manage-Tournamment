import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { remToPx } from "@/lib/design-tokens/css-vars";
import { font } from "@/lib/design-tokens/tokens";
import { DocPage, DocSection } from "./doc-page";

type Step = keyof typeof font.scale;

/** Literal class names so Tailwind can see them. */
const STEP_CLASS: Record<Step, string> = {
  xs: "text-xs",
  sm: "text-sm",
  base: "text-base",
  lg: "text-lg",
  xl: "text-xl",
  "2xl": "text-2xl",
  "3xl": "text-3xl",
  "4xl": "text-4xl",
};

const MATCHES = [
  { court: "Campo 1", home: "Sabbia Nera", away: "Tape Crew", score: "21–19" },
  { court: "Campo 2", home: "Rete Alta", away: "Muro Giallo", score: "15–21" },
  { court: "Campo 3", home: "Bagnasciuga", away: "Libero Club", score: "21–8" },
  {
    court: "Campo 4",
    home: "Schiacciata",
    away: "Bagher Bros",
    score: "11–21",
  },
];

function TipografiaPage() {
  const { heading, body, mono } = font.family;
  return (
    <DocPage
      title="Tipografia"
      intro={`Titoli in ${heading.name}, testo in ${body.name} a ${font.bodySize}, punteggi in ${mono.name} con cifre tabellari.`}
    >
      <DocSection
        id="famiglie"
        title="Famiglie"
        description="Caricate con next/font/google; le classi font-heading, font-sans e font-mono usano le variabili CSS dei font."
      >
        <div className="grid gap-space-3 md:grid-cols-3">
          <figure className="flex flex-col gap-stack-sm border border-border p-inset">
            <p className="font-heading text-4xl font-bold">Aa</p>
            <figcaption className="text-sm">
              <span className="font-semibold">Titoli · {heading.name}</span>
              <br />
              <code className="text-muted-foreground">font-heading</code>
            </figcaption>
          </figure>
          <figure className="flex flex-col gap-stack-sm border border-border p-inset">
            <p className="font-sans text-4xl">Aa</p>
            <figcaption className="text-sm">
              <span className="font-semibold">Testo · {body.name}</span>
              <br />
              <code className="text-muted-foreground">font-sans</code>
            </figcaption>
          </figure>
          <figure className="flex flex-col gap-stack-sm border border-border p-inset">
            <p className="font-mono text-4xl">21–19</p>
            <figcaption className="text-sm">
              <span className="font-semibold">Punteggi · {mono.name}</span>
              <br />
              <code className="text-muted-foreground">font-mono</code>
            </figcaption>
          </figure>
        </div>
      </DocSection>

      <DocSection
        id="titoli"
        title="Titoli"
        description={`${heading.name}, interlinea stretta, peso 600–700.`}
      >
        <div className="flex flex-col gap-stack border-l-4 border-tape pl-inset">
          <p className="font-heading text-4xl font-bold">Finale BLVS Court</p>
          <p className="font-heading text-3xl font-bold">
            Tabellone principale
          </p>
          <p className="font-heading text-2xl font-semibold">Girone A</p>
          <p className="font-heading text-xl font-semibold">
            Campo 1 · ore 10:30
          </p>
        </div>
      </DocSection>

      <DocSection
        id="testo"
        title="Testo"
        description={`${body.name} a ${font.bodySize}, interlinea 1.5.`}
      >
        <p className="max-w-prose text-base text-pretty">
          Le iscrizioni al torneo restano aperte fino a mezzanotte del giovedì
          precedente. Ogni squadra indica due atleti e un recapito: il tabellone
          viene pubblicato il venerdì mattina insieme agli orari dei campi.
        </p>
        <p className="max-w-prose text-sm text-pretty text-muted-foreground">
          Testo secondario: note, didascalie e informazioni di contorno.
        </p>
      </DocSection>

      <DocSection
        id="scala"
        title="Scala tipografica"
        description="Dimensione e interlinea per ogni gradino: classi text-xs … text-4xl."
      >
        <ul className="flex flex-col divide-y divide-border border-y border-border">
          {(Object.keys(font.scale) as Step[]).map((step) => {
            const { size, lineHeight } = font.scale[step];
            return (
              <li
                key={step}
                className="flex flex-col gap-space-1 py-space-3 sm:flex-row sm:items-baseline sm:gap-space-5"
              >
                <span className="w-64 shrink-0 font-mono text-xs text-muted-foreground">
                  {STEP_CLASS[step]} · {size}/{lineHeight} · {remToPx(size)}
                </span>
                <span className={`${STEP_CLASS[step]} truncate font-heading`}>
                  Beach volley sotto il sole
                </span>
              </li>
            );
          })}
        </ul>
      </DocSection>

      <DocSection
        id="punteggi"
        title="Punteggi"
        description="Cifre tabellari: le colonne restano allineate qualunque sia il punteggio."
      >
        <div className="max-w-xl overflow-hidden border border-border">
          <table className="w-full border-collapse text-left">
            <caption className="sr-only">Risultati di esempio</caption>
            <thead className="bg-primary text-primary-foreground">
              <tr>
                <th scope="col" className="p-space-3 text-sm font-semibold">
                  Campo
                </th>
                <th scope="col" className="p-space-3 text-sm font-semibold">
                  Partita
                </th>
                <th
                  scope="col"
                  className="p-space-3 text-right text-sm font-semibold"
                >
                  Punteggio
                </th>
              </tr>
            </thead>
            <tbody>
              {MATCHES.map((m) => (
                <tr key={m.court} className="border-t border-border">
                  <td className="p-space-3 text-sm text-muted-foreground">
                    {m.court}
                  </td>
                  <td className="p-space-3">
                    {m.home} – {m.away}
                  </td>
                  <td className="p-space-3 text-right font-mono text-xl font-semibold">
                    {m.score}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </DocSection>
    </DocPage>
  );
}

const meta = {
  title: "Design system/Tipografia",
  component: TipografiaPage,
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof TipografiaPage>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Tipografia: Story = {};
