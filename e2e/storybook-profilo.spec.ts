import type { Page } from "@playwright/test";
import { expect, expectNoA11yViolations, test } from "./fixtures";
import { gotoStory, storyScope, waitForAnimations } from "./storybook-helpers";

/** Profile screens (w-profilo, w-profilo-modifica) in the player shell. */
const STORY = (name: string) => `profilo-schermate--${name}`;

const VIEWPORTS = [
  { name: "390", width: 390, height: 844 },
  { name: "1440", width: 1440, height: 900 },
] as const;

const STORIES = [
  "profilo-default",
  "profilo-categoria-bloccata",
  "profilo-email-in-attesa",
  "profilo-caricamento",
  "profilo-scaduto",
  "profilo-testo-lungo",
  "profilo-testo-200",
  "modifica",
  "modifica-errori-campi",
  "modifica-invio-con-errori",
  "modifica-invio-in-corso",
  "modifica-caricamento",
  "modifica-salvata",
  "modifica-sessione-scaduta",
  "modifica-categoria-bloccata",
  "modifica-testo-lungo",
  "modifica-testo-200",
  "dialog-modifiche-non-salvate",
];

/**
 * The focused element must sit below the topbar whenever the bar is
 * sticky (from md): `scroll-padding-top` keeps it clear.
 */
async function expectFocusClearOfTopbar(page: Page) {
  const { top, barBottom, sticky, inBar } = await page.evaluate(() => {
    const el = document.activeElement as HTMLElement;
    const bar = document.querySelector("header")!;
    return {
      // The skip link is meant to appear at the very top.
      inBar: bar.contains(el) || el.matches('a[href="#contenuto"]'),
      top: el.getBoundingClientRect().top,
      barBottom: bar.getBoundingClientRect().bottom,
      sticky: getComputedStyle(bar).position === "sticky",
    };
  });
  if (sticky && !inBar) expect(top).toBeGreaterThanOrEqual(barBottom - 1);
}

for (const viewport of VIEWPORTS) {
  test.describe(`profilo a ${viewport.name}px`, () => {
    test.use({ viewport: { width: viewport.width, height: viewport.height } });

    test("nessuna violazione axe in tutti gli stati", async ({ page }) => {
      test.setTimeout(STORIES.length * 4_000);
      for (const name of STORIES) {
        await gotoStory(page, STORY(name));
        await expectNoA11yViolations(page, await storyScope(page));
        const scrollWidth = await page.evaluate(
          () => document.documentElement.scrollWidth,
        );
        expect(
          scrollWidth,
          `${name}: niente scroll orizzontale`,
        ).toBeLessThanOrEqual(viewport.width);
      }
    });

    test("gli errori stanno subito sotto il proprio campo", async ({
      page,
    }) => {
      await gotoStory(page, STORY("modifica-errori-campi"));
      const invalid = page.locator('[aria-invalid="true"]');
      await expect(invalid).toHaveCount(3);

      for (const control of await invalid.all()) {
        const errorId = (await control.getAttribute("aria-describedby"))!.split(
          " ",
        )[0];
        const error = page.locator(`[id="${errorId}"]`);
        await expect(error).toBeVisible();
        await expect(error).toContainText("Errore:");
        // Same field wrapper, right after the control.
        const sameField = await control.evaluate(
          (node, id) =>
            node
              .closest("[data-slot=field], [data-slot=radio-card-group]")
              ?.contains(document.getElementById(id)) ?? false,
          errorId,
        );
        expect(sameField).toBe(true);
        const controlBox = (await control.boundingBox())!;
        const errorBox = (await error.boundingBox())!;
        const gap = errorBox.y - (controlBox.y + controlBox.height);
        expect(gap).toBeGreaterThanOrEqual(0);
        expect(gap).toBeLessThan(48);
      }
    });

    test("il focus non finisce mai sotto la topbar", async ({ page }) => {
      await gotoStory(page, STORY("modifica-testo-200"));
      // Tab through every control of the page.
      let leftDocument = false;
      for (let i = 0; i < 40; i++) {
        await page.keyboard.press("Tab");
        const onBody = await page.evaluate(
          () =>
            !document.activeElement || document.activeElement === document.body,
        );
        if (onBody) {
          leftDocument = true;
          break;
        }
        await expectFocusClearOfTopbar(page);
      }
      expect(leftDocument, "il focus esce dalla pagina: nessuna trappola").toBe(
        true,
      );

      // After a failed submit (button at the bottom of the page) focus
      // jumps back up to the first error, below the sticky bar.
      await gotoStory(page, STORY("modifica-invio-con-errori"));
      const nome = page.getByRole("textbox", { name: /^Nome/ });
      await page.evaluate(() =>
        window.scrollTo(0, document.documentElement.scrollHeight),
      );
      await page.getByRole("button", { name: "Salva modifiche" }).click();
      await expect(nome).toBeFocused();
      await expect(nome).toHaveAttribute("aria-invalid", "true");
      await expectFocusClearOfTopbar(page);
    });

    test("uscire con modifiche non salvate chiede conferma", async ({
      page,
    }) => {
      await gotoStory(page, STORY("modifica"));
      const nome = page.getByRole("textbox", { name: /^Nome/ });
      await nome.fill("Marcello");
      await page.getByRole("link", { name: "Annulla" }).click();

      const dialog = page.getByRole("alertdialog", {
        name: "Uscire senza salvare?",
      });
      await expect(dialog).toBeVisible();
      await waitForAnimations(page);
      await expect(
        dialog.getByRole("button", { name: "Resta sulla pagina" }),
      ).toBeFocused();
      await expectNoA11yViolations(page, await storyScope(page));

      await page.keyboard.press("Escape");
      await expect(dialog).toBeHidden();
      await expect(nome).toHaveValue("Marcello");
    });
  });
}
