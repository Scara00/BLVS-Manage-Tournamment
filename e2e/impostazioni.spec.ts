import type { Locator } from "@playwright/test";
import { expect, expectNoA11yViolations, test } from "./fixtures";
import { waitForAnimations } from "./storybook-helpers";

/**
 * BLVS-53 on the demo (no Supabase env): the demo player «Luca Rossi». A
 * demo deletion only marks this browser as signed out (a cookie), so each
 * test, with its own context, starts from a live account. The real
 * deletion runs against Supabase in e2e/supabase/impostazioni.spec.ts.
 */

/** The «describedby» text of a control, as a screen reader reads it. */
async function descrizione(control: Locator): Promise<string> {
  return control.evaluate((el) =>
    (el.getAttribute("aria-describedby") ?? "")
      .split(/\s+/)
      .map((id) => document.getElementById(id)?.textContent ?? "")
      .join(" "),
  );
}

test("w-impostazioni: tre sezioni, riga pubblica e accessibilità", async ({
  page,
}) => {
  await page.goto("/impostazioni");
  await expect(page).toHaveTitle("Impostazioni · BLVS");
  await expect(
    page.getByRole("heading", { level: 1, name: "Impostazioni" }),
  ).toBeVisible();
  for (const name of [
    "Password",
    "Consenso e dati pubblici",
    "Cancella l'account",
  ]) {
    await expect(page.getByRole("heading", { level: 2, name })).toBeVisible();
  }
  const riga = page.locator("[data-slot=riga-pubblica]");
  await expect(
    riga.getByText("Luca Rossi").filter({ visible: true }),
  ).toBeVisible();
  await expectNoA11yViolations(page);
});

test("cambio password: errori accanto ai campi, poi salvataggio", async ({
  page,
}) => {
  await page.goto("/impostazioni");
  const attuale = page.getByLabel("Password attuale");
  await attuale.fill("sbagliata-123");
  await page.getByLabel(/^Nuova password/).fill("Nuova-password-9");
  await page.getByLabel("Ripeti la nuova password").fill("Nuova-password-9");
  await page.getByRole("button", { name: "Cambia password" }).click();

  await expect(attuale).toHaveAttribute("aria-invalid", "true");
  await expect(attuale).toBeFocused();
  expect(await descrizione(attuale)).toContain(
    "La password attuale non è corretta.",
  );
  await expectNoA11yViolations(page);

  await attuale.fill("Password-attuale-1");
  await page.getByLabel(/^Nuova password/).fill("Nuova-password-9");
  await page.getByLabel("Ripeti la nuova password").fill("Nuova-password-9");
  await page.getByRole("button", { name: "Cambia password" }).click();
  await expect(
    page.getByRole("status").filter({ hasText: "Password aggiornata" }),
  ).toBeVisible();
});

test("cancellazione da tastiera: la riga che sparisce, conferma, «Account cancellato»", async ({
  page,
}) => {
  await page.goto("/impostazioni/elimina-account");
  await expect(
    page.getByRole("heading", { level: 1, name: "Cancella l'account" }),
  ).toBeVisible();

  // The player's row, which the deletion removes from the standing.
  await expect(
    page.getByText("Luca Rossi").filter({ visible: true }),
  ).toBeVisible();
  await expect(
    page.getByText(/questa riga sparisce e la classifica si ricalcola/),
  ).toBeVisible();
  await expect(page.getByText("Giocatore anonimo")).toHaveCount(0);
  await expectNoA11yViolations(page);

  // Empty confirmation: the error sits next to the field, nothing opens.
  const campo = page.getByLabel(/Scrivi ELIMINA/);
  await campo.focus();
  await page.keyboard.press("Enter");
  await expect(campo).toHaveAttribute("aria-invalid", "true");
  expect(await descrizione(campo)).toContain("Scrivi ELIMINA per confermare.");
  await expect(page.getByRole("alertdialog")).toHaveCount(0);
  await expectNoA11yViolations(page);

  // Keyboard only: type, Enter, the dialog takes focus on «No», Tab to «Sì».
  await campo.focus();
  await page.keyboard.type("ELIMINA");
  await page.keyboard.press("Enter");
  const dialogo = page.getByRole("alertdialog");
  await expect(dialogo).toBeVisible();
  await expect(dialogo.locator("*:focus")).toHaveCount(1);
  await waitForAnimations(page);
  await expectNoA11yViolations(page);
  const si = dialogo.getByRole("button", { name: "Sì, cancella l'account" });
  for (let i = 0; i < 3; i++) {
    if (await si.evaluate((el) => el === document.activeElement)) break;
    await page.keyboard.press("Tab");
  }
  await expect(si).toBeFocused();
  await page.keyboard.press("Enter");

  await expect(page).toHaveURL(/\/account-cancellato$/);
  await expect(
    page.getByRole("heading", { level: 1, name: "Account cancellato" }),
  ).toBeVisible();
  await expectNoA11yViolations(page);

  // Signed out: the settings ask to sign in again.
  await page.goto("/impostazioni");
  await expect(
    page.getByRole("heading", { level: 2, name: "Sessione scaduta" }),
  ).toBeVisible();
});

test("«Annulla» nel dialogo non cancella nulla", async ({ page }) => {
  await page.goto("/impostazioni/elimina-account");
  await page.getByLabel(/Scrivi ELIMINA/).fill("ELIMINA");
  await page.getByRole("button", { name: "Cancella l'account" }).click();
  const dialogo = page.getByRole("alertdialog");
  await expect(dialogo).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialogo).toBeHidden();
  await expect(page).toHaveURL(/\/impostazioni\/elimina-account$/);
});

for (const path of [
  "/impostazioni",
  "/impostazioni/elimina-account",
  "/account-cancellato",
]) {
  test(`${path}: niente scroll orizzontale da 1440 a 390px, anche con testo al 200%`, async ({
    page,
  }) => {
    await page.goto(path);
    for (const zoom of [false, true]) {
      if (zoom)
        await page.addStyleTag({
          content: "html { font-size: 200% !important; }",
        });
      for (const width of [1440, 1024, 768, 390]) {
        await page.setViewportSize({ width, height: 900 });
        const { scrollWidth, clientWidth } = await page.evaluate(() => ({
          scrollWidth: document.documentElement.scrollWidth,
          clientWidth: document.documentElement.clientWidth,
        }));
        expect(
          scrollWidth,
          `a ${width}px${zoom ? " con testo 200%" : ""}`,
        ).toBeLessThanOrEqual(clientWidth);
      }
    }
  });
}
