import AxeBuilder from "@axe-core/playwright";
import { test as base, expect, type Page } from "@playwright/test";

/** axe-core tags covering WCAG 2.0, 2.1 and 2.2 at levels A and AA. */
export const WCAG_22_AA_TAGS = [
  "wcag2a",
  "wcag2aa",
  "wcag21a",
  "wcag21aa",
  "wcag22aa",
];

export function makeAxeBuilder(page: Page) {
  return new AxeBuilder({ page }).withTags(WCAG_22_AA_TAGS);
}

/**
 * Fails the test on any WCAG 2.2 AA violation. Every e2e spec that visits a
 * page must call it once the page has settled.
 */
export async function expectNoA11yViolations(
  page: Page,
  configure: (builder: AxeBuilder) => AxeBuilder = (b) => b,
) {
  const { violations } = await configure(makeAxeBuilder(page)).analyze();
  const report = violations
    .map(
      (v) =>
        `- [${v.impact}] ${v.id}: ${v.help} (${v.helpUrl})\n` +
        v.nodes.map((n) => `    ${n.target.join(" ")}`).join("\n"),
    )
    .join("\n");
  expect(
    violations,
    `Violazioni di accessibilità su ${page.url()}:\n${report}`,
  ).toEqual([]);
}

export const test = base;
export { expect };
