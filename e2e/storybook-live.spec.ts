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
