import type { Page } from "@playwright/test";
import { expect, expectNoA11yViolations, test } from "./fixtures";
import { waitForAnimations } from "./storybook-helpers";

/**
 * BLVS-18 in the demo (no Supabase): the countdown runs in the browser, so
 * Playwright's clock drives it. 2 hours idle, warning 2 minutes before.
 * /admin/anteprima/bozza is a dev/e2e-only admin page with a draft form.
 */
const PATH = "/admin/anteprima/bozza";

async function openWithClock(page: Page) {
  await page.clock.install();
  await page.goto(PATH);
  await page.waitForLoadState("networkidle");
  await expect(
    page.getByRole("heading", { level: 1, name: "Anteprima bozza" }),
  ).toBeVisible();
}

async function openWarning(page: Page) {
  await page.clock.fastForward("01:58:00");
  const dialog = page.getByRole("alertdialog", {
    name: "La sessione sta per scadere",
  });
  await expect(dialog).toBeVisible();
  await waitForAnimations(page);
  return dialog;
}

test.describe("avviso di scadenza della sessione admin", () => {
  test("2 minuti prima compare l'avviso, annunciato e con il focus su «Prolunga sessione»", async ({
    page,
  }) => {
    await openWithClock(page);
    const dialog = await openWarning(page);

    // What a screen reader announces on open: role, name and description.
    await expect(dialog).toHaveAccessibleDescription(
      // The clock keeps running in real time after the jump.
      /si chiude tra (2 minuti|1 minuto e \d+ secondi?)\./,
    );
    const extend = page.getByRole("button", { name: "Prolunga sessione" });
    await expect(extend).toBeFocused();
    await expect(page.getByRole("button", { name: "Esci" })).toBeVisible();
    await expect(page.getByTestId("admin-session-countdown")).toHaveText(
      /^(2:00|1:[0-5]\d)$/,
    );
    await expectNoA11yViolations(page);
  });

  test("da tastiera: il focus resta nell'avviso, Invio prolunga e i dati restano", async ({
    page,
  }) => {
    await openWithClock(page);
    const nome = page.getByLabel("Nome della tappa");
    await nome.fill("Tappa di Rimini");
    const dialog = await openWarning(page);

    for (let i = 0; i < 4; i++) {
      await page.keyboard.press("Tab");
      await expect
        .poll(() =>
          dialog.evaluate((node) => node.contains(document.activeElement)),
        )
        .toBe(true);
    }
    await page.getByRole("button", { name: "Prolunga sessione" }).focus();
    await page.keyboard.press("Enter");

    await expect(dialog).toBeHidden();
    await expect(page.getByText("Sessione prolungata")).toBeVisible();
    await expect(nome).toHaveValue("Tappa di Rimini");
    await expect(page).toHaveURL(PATH);
    await expectNoA11yViolations(page);
  });

  test("Esc prolunga la sessione", async ({ page }) => {
    await openWithClock(page);
    const dialog = await openWarning(page);
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(page.getByText("Sessione prolungata")).toBeVisible();
  });

  test("se scade, le bozze restano sul dispositivo e tornano dopo", async ({
    page,
  }) => {
    await openWithClock(page);
    await page.getByLabel("Nome della tappa").fill("Tappa di Jesolo");
    await page.clock.fastForward("02:00:00");

    await expect(page).toHaveURL(
      `/sessione-scaduta?da=${encodeURIComponent(PATH)}`,
    );
    await expect(
      page.getByRole("heading", {
        level: 1,
        name: "Per sicurezza abbiamo chiuso la sessione di amministrazione",
      }),
    ).toBeVisible();
    const draft = page.getByRole("link", { name: "Anteprima · Nuova tappa" });
    await expect(draft).toBeVisible();
    await expectNoA11yViolations(page);

    await draft.click();
    await expect(page).toHaveURL(PATH);
    await expect(page.getByLabel("Nome della tappa")).toHaveValue(
      "Tappa di Jesolo",
    );
  });
});
