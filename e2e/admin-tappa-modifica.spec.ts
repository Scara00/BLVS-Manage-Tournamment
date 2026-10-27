import { expect, expectNoA11yViolations, test } from "./fixtures";

/**
 * w-admin-tappa-modifica on the demo stages (no Supabase env, so nothing
 * is saved: the checks are the prefilled form and the client-side block).
 * Saving, the trigger and version conflicts are covered by the PGlite and
 * action unit tests.
 */
const PATH = "/admin/tappe/rimini/modifica";

test.beforeEach(async ({ page }) => {
  await page.goto(PATH);
  await expect(page).toHaveTitle("Modifica tappa · Amministrazione · BLVS");
  await expect(
    page.getByRole("heading", { level: 1, name: "Modifica tappa" }),
  ).toBeVisible();
});

test("il modulo è precompilato e accessibile", async ({ page }) => {
  await expect(
    page.getByRole("textbox", { name: /Nome della tappa/ }),
  ).toHaveValue("Tappa 2 · Rimini");
  const postiM = page.getByRole("spinbutton", {
    name: /tabellone maschile/,
  });
  await expect(postiM).toHaveValue("16");
  await expect(postiM).toHaveAccessibleDescription(
    "Iscritti attuali: 12. Il massimo va da 12 a 256.",
  );
  await expectNoA11yViolations(page);
});

test("un massimo sotto gli iscritti è bloccato e l'errore è annunciato accanto al campo", async ({
  page,
}) => {
  await page.waitForLoadState("networkidle");
  const postiM = page.getByRole("spinbutton", {
    name: /tabellone maschile/,
  });
  await postiM.fill("10");
  await page.getByRole("button", { name: "Salva modifiche" }).click();

  await expect(postiM).toBeFocused();
  await expect(postiM).toHaveAttribute("aria-invalid", "true");
  await expect(postiM).toHaveAccessibleDescription(
    /^Errore: Il massimo non può scendere sotto 12/,
  );
  // The error is the element right after the control, inside its field.
  const field = page.locator("[data-slot=field]", { has: postiM });
  await expect(field.locator("[data-slot=field-error]")).toHaveText(
    /Il massimo non può scendere sotto 12/,
  );
  await expect(field.getByRole("status")).toHaveText(
    "Errore: Il massimo non può scendere sotto 12",
  );
  // Still on the page: nothing was sent.
  await expect(page).toHaveURL(new RegExp(`${PATH}$`));
  await expectNoA11yViolations(page);
});

test("l'avviso sui gironi sta sopra il modulo su mobile e accanto da desktop", async ({
  page,
}) => {
  const panel = page.getByRole("region", { name: "Gironi" });
  const form = page.getByRole("form", { name: "Dati della tappa" });
  const p = (await panel.boundingBox())!;
  const f = (await form.boundingBox())!;
  const width = page.viewportSize()!.width;
  if (width < 1024) {
    expect(p.y + p.height).toBeLessThanOrEqual(f.y + 1);
  } else {
    expect(p.x).toBeGreaterThanOrEqual(f.x + f.width - 1);
  }
});

test("una tappa in corso non si modifica", async ({ page }) => {
  await page.goto("/admin/tappe/jesolo/modifica");
  await expect(
    page.getByRole("heading", { level: 2, name: "Tappa non modificabile" }),
  ).toBeVisible();
  await expect(page.getByRole("form")).toHaveCount(0);
  await expectNoA11yViolations(page);
});
