import { expect, expectNoA11yViolations, test } from "./fixtures";
import { gotoStory, storyScope } from "./storybook-helpers";

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

test("Storybook espone almeno una story", async ({ request }) => {
  const index: StoryIndex = await (await request.get("/index.json")).json();
  expect(Object.values(index.entries).some((e) => e.type === "story")).toBe(
    true,
  );
});

test("ogni story rispetta WCAG 2.2 AA a 390 e 1440 px", async ({
  page,
  request,
}) => {
  const index: StoryIndex = await (await request.get("/index.json")).json();
  const stories = Object.values(index.entries).filter(
    (e) => e.type === "story",
  );
  // One axe run per story and viewport: the budget grows with the catalogue.
  test.setTimeout(stories.length * VIEWPORTS.length * 3_000);

  for (const story of stories) {
    for (const viewport of VIEWPORTS) {
      await test.step(`${story.title} › ${story.name} @ ${viewport.name}px`, async () => {
        await page.setViewportSize(viewport);
        await gotoStory(page, story.id);
        // Scope to the story and its overlay portals: the iframe shell is
        // not part of the app.
        await expectNoA11yViolations(page, await storyScope(page));
        // No horizontal page scroll at either viewport.
        expect(
          await page.evaluate(() => document.documentElement.scrollWidth),
        ).toBeLessThanOrEqual(viewport.width);
      });
    }
  }
});
