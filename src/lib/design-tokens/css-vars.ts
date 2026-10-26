import { color, font, radius, space } from "./tokens";

/**
 * Naming rules that map each TS token to its CSS variables in globals.css.
 *
 * - Colours: raw hex in `:root` as `--blvs-<path>`, exposed to Tailwind in
 *   `@theme inline` as `--color-<path>` (so `bg-tape`, `text-live-fg`,
 *   `bg-reg-open-bg`). Paths are kebab-cased: `reg.open.bg` → `reg-open-bg`.
 * - Spacing: `--spacing-space-<n>`, `--spacing-inset[-sm|-lg]`,
 *   `--spacing-stack[-sm|-lg]` (`p-space-5`, `p-inset`, `gap-stack-lg`).
 * - Radius: `--radius-<name>`. Type scale: `--text-<step>` and
 *   `--text-<step>--line-height`.
 */

/** Theme names that would clash with a shadcn semantic colour. */
const THEME_ALIASES: Record<string, string> = { accent: "brand-accent" };

const kebab = (s: string) => s.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);

export type ColorTokenEntry = {
  /** Dotted TS path, e.g. `reg.open.bg`. */
  path: string;
  /** Raw hex variable in `:root`. */
  cssVar: string;
  /** Tailwind theme variable; the utility suffix is `themeVar` minus `--color-`. */
  themeVar: string;
  value: string;
};

function flatten(
  node: Record<string, unknown>,
  prefix: string[] = [],
): [string[], string][] {
  return Object.entries(node).flatMap(([key, value]) =>
    typeof value === "string"
      ? [[[...prefix, key], value] as [string[], string]]
      : flatten(value as Record<string, unknown>, [...prefix, key]),
  );
}

export const colorEntries: ColorTokenEntry[] = flatten(color).map(
  ([segments, value]) => {
    const name = segments.map(kebab).join("-");
    return {
      path: segments.join("."),
      cssVar: `--blvs-${name}`,
      themeVar: `--color-${THEME_ALIASES[name] ?? name}`,
      value,
    };
  },
);

const scopedName = (base: string, key: string) =>
  key === "default" ? base : `${base}-${key}`;

/** Literal theme variables (name → value) that `@theme` must declare. */
export const themeLiterals: Record<string, string> = {
  ...Object.fromEntries(
    Object.entries(space).flatMap(([key, value]) =>
      typeof value === "string"
        ? [[`--spacing-space-${key}`, value]]
        : Object.entries(value).map(([sub, v]) => [
            scopedName(`--spacing-${key}`, sub),
            v,
          ]),
    ),
  ),
  ...Object.fromEntries(
    Object.entries(radius).map(([key, value]) => [`--radius-${key}`, value]),
  ),
  ...Object.fromEntries(
    Object.entries(font.scale).flatMap(([step, { size, lineHeight }]) => [
      [`--text-${step}`, size],
      [`--text-${step}--line-height`, lineHeight],
    ]),
  ),
};

/** Tailwind font families wired to the next/font variables. */
export const fontThemeVars: Record<string, string> = {
  "--font-sans": `var(${font.family.body.cssVar})`,
  "--font-heading": `var(${font.family.heading.cssVar})`,
  "--font-mono": `var(${font.family.mono.cssVar})`,
};

/** `0.25rem` → `4px` (root font size is fixed at 16 px). */
export function remToPx(rem: string): string {
  return `${parseFloat(rem) * 16}px`;
}
