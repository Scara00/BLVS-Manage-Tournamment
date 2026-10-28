import { expect, expectNoA11yViolations, test } from "./fixtures";
import { allega, misura, tastieraEZoom } from "./a11y/misure";
import { SCHERMATE } from "./a11y/schermate";
import { gotoStory, PORTAL_SELECTOR, storyScope } from "./storybook-helpers";

/**
 * BLVS-56 · WCAG 2.2 AA final check, Storybook side: the screens the demo
 * app can't show (dialogs mid-flow, signed-in profile), at 390 and 1440 px,
 * with the same measurements as e2e/a11y.spec.ts.
 */

const VIEWPORTS = [
  { name: "390", width: 390, height: 844 },
  { name: "1440", width: 1440, height: 900 },
];

type StoryIndex = { entries: Record<string, { id: string; type: string }> };

test("ogni storia dell'inventario esiste", async ({ request }) => {
  const index: StoryIndex = await (await request.get("/index.json")).json();
  const ids = new Set(Object.keys(index.entries));
  for (const s of SCHERMATE) {
    for (const story of s.storie ?? []) {
      expect(ids.has(story), `${s.id}: storia ${story} assente`).toBe(true);
    }
  }
});

for (const schermata of SCHERMATE.filter((s) => s.storie?.length)) {
  test(`${schermata.id} · ${schermata.titolo}`, async ({ page }, testInfo) => {
    test.setTimeout(30_000 + schermata.storie!.length * 20_000);
    for (const story of schermata.storie!) {
      for (const viewport of VIEWPORTS) {
        await test.step(`${story} @ ${viewport.name}px`, async () => {
          await page.setViewportSize(viewport);
          await gotoStory(page, story);
          const scope = await storyScope(page);
          await expectNoA11yViolations(page, (b) =>
            scope(b).disableRules(
              (schermata.disattiva ?? []).map((r) => r.regola),
            ),
          );
          const m = await misura(
            page,
            schermata,
            {
              pagina: `#storybook-root, ${PORTAL_SELECTOR}`,
              // Courtside = the content, not the shell's header and footer.
              campo: `#storybook-root:not(:has(main)), #storybook-root main, ${PORTAL_SELECTOR}`,
            },
            viewport,
            `storia ${story}`,
          );
          // A «Testo200» story already doubles the text: zooming it again
          // (800%) is beyond WCAG 1.4.4 + 1.4.10, so only the keyboard runs.
          const testoGrande = /testo-?200|testo-lungo|long-text/.test(story);
          if (viewport.width >= 1440) {
            Object.assign(m, await tastieraEZoom(page, !testoGrande));
          }
          await allega(testInfo, m);
          expect(m.scrollOrizzontale, "scroll orizzontale").toBe(false);
          expect(
            m.targetSottoSoglia,
            `Controlli sotto ${m.sogliaTarget}×${m.sogliaTarget} px`,
          ).toEqual([]);
          expect(
            m.contrastoSottoSoglia,
            "Punteggi, posizioni e Live sotto 7:1",
          ).toEqual([]);
          if (m.tastiera) {
            expect(
              m.tastiera.senzaIndicatore,
              "focus senza indicatore",
            ).toEqual([]);
            expect(m.tastiera.oscurati, "focus nascosto").toEqual([]);
            expect(
              m.zoom200?.scrollOrizzontale ?? false,
              "scroll a zoom 200%",
            ).toBe(false);
            expect(
              m.zoom400?.scrollOrizzontale ?? false,
              "scroll a zoom 400%",
            ).toBe(false);
          }
        });
      }
    }
  });
}
