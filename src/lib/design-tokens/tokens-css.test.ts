// @vitest-environment node
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { colorEntries, fontThemeVars, themeLiterals } from "./css-vars";

const css = readFileSync(join(process.cwd(), "src/app/globals.css"), "utf8");

/** Body of the first top-level block whose selector matches. */
function block(selector: RegExp): string {
  const match = selector.exec(css);
  if (!match) throw new Error(`Blocco ${selector} non trovato in globals.css`);
  const start = css.indexOf("{", match.index) + 1;
  let depth = 1;
  let i = start;
  while (depth > 0 && i < css.length) {
    if (css[i] === "{") depth++;
    if (css[i] === "}") depth--;
    i++;
  }
  return css.slice(start, i - 1);
}

/** All `--name: value;` declarations of a block. */
function declarations(body: string): Map<string, string> {
  const out = new Map<string, string>();
  for (const [, name, value] of body.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) {
    out.set(name, value.trim());
  }
  return out;
}

const root = declarations(block(/^:root\s*\{/m));
const theme = declarations(block(/^@theme static\s*\{/m));
const themeInline = declarations(block(/^@theme inline\s*\{/m));

describe("token TS ↔ globals.css", () => {
  it.each(colorEntries.map((e) => [e.path, e] as const))(
    "colore %s",
    (_path, entry) => {
      expect(root.get(entry.cssVar), `${entry.cssVar} in :root`).toBe(
        entry.value,
      );
      expect(
        themeInline.has(entry.themeVar),
        `${entry.themeVar} in @theme inline`,
      ).toBe(true);
    },
  );

  it.each(Object.entries(themeLiterals))("%s = %s", (name, value) => {
    expect(theme.get(name), `${name} in @theme`).toBe(value);
  });

  it.each(Object.entries(fontThemeVars))("%s = %s", (name, value) => {
    expect(themeInline.get(name), `${name} in @theme inline`).toBe(value);
  });

  it("raggio di base a zero", () => {
    expect(root.get("--radius")).toBe("0px");
  });
});
