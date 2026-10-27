import AxeBuilder from "@axe-core/playwright";
import { expect, expectNoA11yViolations, test } from "./fixtures";

type StoryIndex = {
  entries: Record<
    string,
    { id: string; title: string; name: string; type: string }
  >;
};

const VIEWPORTS = [
  { name: "390", width: 390, height: 844 },
  { name: "1440", width: 1440, height: 900 },
];

async function scoreboardStories(
  request: Parameters<Parameters<typeof test>[2]>[0]["request"],
) {
  const index: StoryIndex = await (await request.get("/index.json")).json();
  return Object.values(index.entries).filter(
    (e) => e.type === "story" && e.id.startsWith("tabellone-"),
  );
}

test.beforeEach(async ({ page }) => {
  // No frame mid-animation: axe measures the settled colours.
  await page.emulateMedia({ reducedMotion: "reduce" });
});

test("i componenti del tabellone rispettano il contrasto AAA (7:1)", async ({
  page,
  request,
}) => {
  const stories = await scoreboardStories(request);
  expect(stories.length).toBeGreaterThan(0);

  for (const story of stories) {
    for (const viewport of VIEWPORTS) {
      await test.step(`${story.title} › ${story.name} @ ${viewport.name}px`, async () => {
        await page.setViewportSize(viewport);
        await page.goto(`/iframe.html?id=${story.id}&viewMode=story`);
        await page.locator("#storybook-root > *").first().waitFor();

        const { violations } = await new AxeBuilder({ page })
          .include("#storybook-root")
          .withRules(["color-contrast-enhanced"])
          .analyze();
        expect(
          violations.flatMap((v) => v.nodes.map((n) => n.target.join(" "))),
          `Contrasto AAA insufficiente in ${story.id}`,
        ).toEqual([]);
        await expectNoA11yViolations(page, (b) => b.include("#storybook-root"));

        // Reduced motion: nothing is animating.
        const running = await page
          .locator("#storybook-root")
          .evaluate((root) => root.getAnimations({ subtree: true }).length);
        expect(running).toBe(0);
      });
    }
  }
});

test("FlipDigits espone un solo testo accessibile", async ({ page }) => {
  await page.goto(
    "/iframe.html?id=tabellone-flipdigits--default&viewMode=story",
  );
  const root = page.locator("#storybook-root");
  await root.locator("[data-slot=flip-digits]").waitFor();

  const texts = await root.evaluate((el) => {
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    const out: string[] = [];
    while (walker.nextNode()) {
      const node = walker.currentNode;
      if (
        node.textContent?.trim() &&
        !node.parentElement?.closest('[aria-hidden="true"]')
      ) {
        out.push(node.textContent);
      }
    }
    return out;
  });
  expect(texts).toEqual(["21"]);
  await expectNoA11yViolations(page, (b) => b.include("#storybook-root"));
});
