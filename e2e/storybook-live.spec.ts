import AxeBuilder from "@axe-core/playwright";
import { expect, expectNoA11yViolations, test } from "./fixtures";
import { gotoStory } from "./storybook-helpers";

const LIVE_BAR_STORIES = [
  "live-livebar--live",
  "live-livebar--offline",
  "live-livebar--riconnessione",
  "live-livebar--connessione",
  "live-schermate--partite",
  "live-schermate--classifica-offline",
];

test.beforeEach(async ({ page }) => {
  // Settled colours only: no pulse or spinner frame under axe.
  await page.emulateMedia({ reducedMotion: "reduce" });
});

test("la LiveBar ha contrasto AAA (7:1) in ogni stato", async ({ page }) => {
  for (const id of LIVE_BAR_STORIES) {
    await test.step(id, async () => {
      await gotoStory(page, id);
      const { violations } = await new AxeBuilder({ page })
        .include("[data-slot=live-bar]")
        .withRules(["color-contrast-enhanced"])
        .analyze();
      expect(
        violations.flatMap((v) => v.nodes.map((n) => n.target.join(" "))),
        `Contrasto AAA insufficiente in ${id}`,
      ).toEqual([]);
      await expectNoA11yViolations(page, (b) => b.include("#storybook-root"));

      const running = await page
        .locator("#storybook-root")
        .evaluate((root) => root.getAnimations({ subtree: true }).length);
      expect(running).toBe(0);
    });
  }
});

/** w-live (BLVS-36): scores, positions and «Live» at 7:1 in every state. */
const LIVE_TAPPA_STORIES = [
  "live-live-della-tappa--success",
  "live-live-della-tappa--offline",
  "live-live-della-tappa--long-text",
  "live-live-della-tappa--empty",
];

test("live della tappa: punteggi, posizioni e Live con contrasto AAA (7:1)", async ({
  page,
}) => {
  for (const viewport of [
    { width: 390, height: 844 },
    { width: 1440, height: 900 },
  ]) {
    await page.setViewportSize(viewport);
    for (const id of LIVE_TAPPA_STORIES) {
      await test.step(`${id} @${viewport.width}`, async () => {
        await gotoStory(page, id);
        const { violations } = await new AxeBuilder({ page })
          .include("#storybook-root")
          .withRules(["color-contrast-enhanced"])
          .analyze();
        expect(
          violations.flatMap((v) => v.nodes.map((n) => n.target.join(" "))),
          `Contrasto AAA insufficiente in ${id}`,
        ).toEqual([]);
        const overflow = await page.evaluate(
          () =>
            document.documentElement.scrollWidth -
            document.documentElement.clientWidth,
        );
        expect(
          overflow,
          `scorrimento orizzontale in ${id}`,
        ).toBeLessThanOrEqual(0);
      });
    }
  }
});
