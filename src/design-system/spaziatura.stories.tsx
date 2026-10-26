import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { remToPx, themeLiterals } from "@/lib/design-tokens/css-vars";
import { radius } from "@/lib/design-tokens/tokens";
import { DocPage, DocSection } from "./doc-page";

const spacing = Object.entries(themeLiterals).filter(([name]) =>
  name.startsWith("--spacing-"),
);
const scale = spacing.filter(([name]) => name.startsWith("--spacing-space-"));
const densities = spacing.filter(
  ([name]) => !name.startsWith("--spacing-space-"),
);

/** `--spacing-inset-lg` → `inset-lg` (the Tailwind utility suffix). */
const suffix = (name: string) => name.replace("--spacing-", "");

function ScaleList({ items }: { items: [string, string][] }) {
  return (
    <ul className="flex flex-col gap-space-3">
      {items.map(([name, value]) => (
        <li
          key={name}
          className="grid grid-cols-[9rem_1fr] items-center gap-space-3 sm:grid-cols-[14rem_1fr]"
        >
          <span className="flex flex-col text-sm">
            <code className="font-semibold">{suffix(name)}</code>
            <span className="font-mono text-xs text-muted-foreground">
              {value} · {remToPx(value)}
            </span>
          </span>
          <span
            aria-hidden
            className="block h-space-5 bg-tape"
            style={{ width: `var(${name})` }}
          />
        </li>
      ))}
    </ul>
  );
}

function SpaziaturaPage() {
  return (
    <DocPage
      title="Spaziatura"
      intro="Scala ampia su base 4 px, affiancata alla scala numerica di Tailwind: usa p-space-5, gap-space-3, p-inset, gap-stack."
    >
      <DocSection
        id="scala-spazi"
        title="Scala"
        description="Classi *-space-1 … *-space-9."
      >
        <ScaleList items={scale} />
      </DocSection>
      <DocSection
        id="densita"
        title="Densità semantiche"
        description="inset: padding interno dei componenti. stack: distanza verticale tra blocchi."
      >
        <ScaleList items={densities} />
      </DocSection>
      <DocSection
        id="raggi"
        title="Raggi"
        description="Angoli vivi ovunque. Il raggio pieno è riservato a pillole e avatar."
      >
        <div className="flex flex-wrap items-end gap-space-5">
          <figure className="flex flex-col gap-space-2">
            <div
              aria-hidden
              className="size-space-8 rounded-none border-2 border-primary bg-tape"
            />
            <figcaption className="text-sm">
              <code className="font-semibold">rounded-none</code>
              <span className="block font-mono text-xs text-muted-foreground">
                {radius.none}
              </span>
            </figcaption>
          </figure>
          <figure className="flex flex-col gap-space-2">
            <div
              aria-hidden
              className="flex size-space-8 items-center justify-center rounded-full bg-primary font-heading text-xl font-bold text-primary-foreground"
            >
              BL
            </div>
            <figcaption className="text-sm">
              <code className="font-semibold">rounded-full</code>
              <span className="block font-mono text-xs text-muted-foreground">
                {radius.full} · solo avatar
              </span>
            </figcaption>
          </figure>
        </div>
      </DocSection>
    </DocPage>
  );
}

const meta = {
  title: "Design system/Spaziatura",
  component: SpaziaturaPage,
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof SpaziaturaPage>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Spaziatura: Story = {};
