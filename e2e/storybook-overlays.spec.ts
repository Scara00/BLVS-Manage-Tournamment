import type { Locator, Page } from "@playwright/test";
import { expect, expectNoA11yViolations, test } from "./fixtures";
import { gotoStory, storyScope, waitForAnimations } from "./storybook-helpers";

/** Opens the story with the overlay closed, so the keyboard has to open it. */
async function gotoClosed(page: Page, id: string) {
  await gotoStory(page, `${id}&args=defaultOpen:!false`);
}

/**
 * At the edges of the trap focus first lands on a Base UI focus guard, which
 * hands it back to the dialog asynchronously, so poll.
 */
async function expectFocusInside(page: Page, container: Locator) {
  await expect
    .poll(() =>
      container.evaluate((node) => node.contains(document.activeElement)),
    )
    .toBe(true);
}

async function tabUntilFocused(page: Page, target: Locator, max = 10) {
  for (let i = 0; i < max; i++) {
    await page.keyboard.press("Tab");
    if (await target.evaluate((node) => node === document.activeElement)) {
      return;
    }
  }
  throw new Error("Elemento mai raggiunto con Tab");
}

test.describe("overlay da tastiera", () => {
  test("Dialog: si apre con Invio, intrappola il focus, Esc lo chiude", async ({
    page,
  }) => {
    await gotoClosed(page, "ui-dialog--corto");
    const trigger = page.getByRole("button", { name: "Modifica squadra" });

    await tabUntilFocused(page, trigger);
    await page.keyboard.press("Enter");
    const dialog = page.getByRole("dialog", { name: "Modifica squadra" });
    await expect(dialog).toBeVisible();
    await waitForAnimations(page);
    await expectFocusInside(page, dialog);

    for (let i = 0; i < 6; i++) {
      await page.keyboard.press("Tab");
      await expectFocusInside(page, dialog);
    }
    for (let i = 0; i < 6; i++) {
      await page.keyboard.press("Shift+Tab");
      await expectFocusInside(page, dialog);
    }

    await expectNoA11yViolations(page, await storyScope(page));

    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(trigger).toBeFocused();
  });

  test("AlertDialog: il focus va su «Annulla», Esc chiude e torna al trigger", async ({
    page,
  }) => {
    await gotoClosed(page, "ui-alertdialog--predefinito");
    const trigger = page.getByRole("button", { name: "Elimina torneo" });

    await tabUntilFocused(page, trigger);
    await page.keyboard.press("Enter");
    const dialog = page.getByRole("alertdialog");
    await expect(dialog).toBeVisible();
    await expect(page.getByRole("button", { name: "Annulla" })).toBeFocused();

    for (let i = 0; i < 4; i++) {
      await page.keyboard.press("Tab");
      await expectFocusInside(page, dialog);
    }

    await waitForAnimations(page);
    await expectNoA11yViolations(page, await storyScope(page));

    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(trigger).toBeFocused();
  });

  test("Dialog lungo a 390 px: il footer resta visibile e non c'è scroll orizzontale", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await gotoStory(page, "ui-dialog--lungo");

    await expect(
      page.getByRole("button", { name: "Ho capito" }),
    ).toBeInViewport();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(390);
    await expectNoA11yViolations(page, await storyScope(page));
  });

  test("Tabs: le frecce spostano focus e selezione", async ({ page }) => {
    await gotoStory(page, "ui-tabs--predefinito");
    const gironi = page.getByRole("tab", { name: "Gironi" });
    const tabellone = page.getByRole("tab", { name: "Tabellone" });
    const squadre = page.getByRole("tab", { name: "Squadre" });

    await tabUntilFocused(page, gironi);
    await page.keyboard.press("ArrowRight");
    await expect(tabellone).toBeFocused();
    await expect(tabellone).toHaveAttribute("aria-selected", "true");
    // The previous panel lingers (inert) while its exit transition runs.
    await expect(page.getByRole("tabpanel", { name: "Tabellone" })).toHaveText(
      "Eliminazione diretta dagli ottavi alla finale.",
    );

    await page.keyboard.press("End");
    await expect(squadre).toBeFocused();
    await page.keyboard.press("Home");
    await expect(gironi).toBeFocused();
    await expect(gironi).toHaveAttribute("aria-selected", "true");

    await expectNoA11yViolations(page, await storyScope(page));
  });

  test("Toast: si attiva da tastiera e «Annulla» si raggiunge con Tab", async ({
    page,
  }) => {
    await gotoStory(page, "ui-toast--vuoto");
    const trigger = page.getByRole("button", { name: "Elimina squadra" });

    await tabUntilFocused(page, trigger);
    await page.keyboard.press("Enter");
    const region = page.getByRole("region", { name: "Notifiche" });
    await expect(region).toHaveAttribute("aria-live", "polite");
    await expect(region).toContainText("Squadra eliminata");

    await tabUntilFocused(page, page.getByRole("button", { name: "Annulla" }));
    await waitForAnimations(page);
    await expectNoA11yViolations(page, await storyScope(page));

    await page.keyboard.press("Enter");
    await expect(region).toContainText("Eliminazione annullata");
  });
});
