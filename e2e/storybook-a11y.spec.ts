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

  for (const story of stories) {
    for (const viewport of VIEWPORTS) {
      await test.step(`${story.title} › ${story.name} @ ${viewport.name}px`, async () => {
        await page.setViewportSize(viewport);
        await page.goto(`/iframe.html?id=${story.id}&viewMode=story`);
        await page.locator("#storybook-root > *").first().waitFor();
        // Scope to the story: the iframe shell is not part of the app.
        await expectNoA11yViolations(page, (b) => b.include("#storybook-root"));
      });
    }
  }
});
