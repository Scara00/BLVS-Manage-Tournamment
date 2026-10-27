import { expect, expectNoA11yViolations, test } from "./fixtures";

/*
 * w-tappa and w-iscrizione-ok with the demo data (no Supabase in e2e). The
 * demo player is per browser context (cookie), so each test starts with no
 * registration and parallel runs never fill a board.
 */

test("da w-tappe «Vedi la tappa» apre il dettaglio con i due tabelloni", async ({
  page,
}) => {
  await page.goto("/tappe");
  await page
    .getByRole("link", { name: "Vedi la tappa Tappa 2 · Rimini" })
    .filter({ visible: true })
    .click();
  await expect(page).toHaveURL(/\/tappe\/rimini$/);
  await expect(
    page.getByRole("heading", { level: 1, name: "Tappa 2 · Rimini" }),
  ).toBeVisible();

  const maschile = page.getByRole("region", { name: /Maschile/ });
  await expect(maschile).toContainText("5 liberi su 16");
  await expect(maschile).toContainText("La tua categoria");
  await expect(page.getByRole("region", { name: /Femminile/ })).toContainText(
    "0 liberi su 12",
  );
  await expect(page.getByRole("region", { name: "Programma" })).toContainText(
    "gironi dalle 9:30",
  );

  const prendi = page.getByRole("button", {
    name: "Prendi il posto 12 nel maschile",
  });
  await expect(prendi).toBeEnabled();
  await expectNoA11yViolations(page);
});

for (const { id, motivo } of [
  { id: "cagliari", motivo: /iscrizioni a questa tappa sono chiuse/ },
  { id: "pescara", motivo: /annullata/ },
]) {
  test(`${id}: pulsante disattivato con il motivo collegato`, async ({
    page,
  }) => {
    await page.goto(`/tappe/${id}`);
    const prendi = page.getByRole("button", { name: /^Prendi/ });
    await expect(prendi).toHaveAttribute("aria-disabled", "true");
    await expect(prendi).toHaveAccessibleDescription(motivo);

    // The reason is visible text, linked by id.
    const describedBy = await prendi.getAttribute("aria-describedby");
    expect(describedBy).toBeTruthy();
    await expect(page.locator(`[id="${describedBy}"]`)).toBeVisible();

    // Still focusable, so keyboard users hear the reason.
    await prendi.focus();
    await expect(prendi).toBeFocused();
    await expectNoA11yViolations(page);
  });
}

test("prendere il posto: conferma con focus sul titolo e annuncio", async ({
  page,
}) => {
  await page.goto("/tappe/rimini");
  const prendi = page.getByRole("button", {
    name: "Prendi il posto 12 nel maschile",
  });
  await page.waitForLoadState("networkidle");
  await prendi.click();

  await expect(page).toHaveURL(/\/tappe\/rimini\/iscrizione$/);
  await expect(page).toHaveTitle("Iscrizione confermata · BLVS");
  const title = page.getByRole("heading", {
    level: 1,
    name: "Sei iscritto: posto 12 nel maschile",
  });
  await expect(title).toBeFocused();
  await expect(page.getByTestId("annuncio-iscrizione")).toHaveText(
    "Iscrizione confermata: posto 12 nel maschile, Tappa 2 · Rimini.",
  );
  await expect(page.getByTestId("annuncio-iscrizione")).toHaveAttribute(
    "role",
    "status",
  );

  const riepilogo = page.getByLabel("Riepilogo dell'iscrizione");
  await expect(riepilogo).toContainText("28–29 giugno");
  await expect(riepilogo).toContainText("Rimini, Bagno 26");
  await expect(riepilogo).toContainText("Bagno 26, ingresso dal lungomare");
  await expect(riepilogo).toContainText(/21 giugno/);
  await expectNoA11yViolations(page);

  // Back on the stage: a second registration is not offered.
  await page.goto("/tappe/rimini");
  const again = page.getByRole("button", { name: /^Prendi/ });
  await expect(again).toHaveAttribute("aria-disabled", "true");
  await expect(again).toHaveAccessibleDescription(/Sei già iscritto/);
});

test("una bozza aperta via URL mostra la pagina 404", async ({ page }) => {
  await page.goto("/tappe/lignano");
  await expect(
    page.getByRole("heading", { level: 1, name: /non trovata/i }),
  ).toBeVisible();
  await expect(page.getByText(/Lignano/)).toHaveCount(0);
  await expectNoA11yViolations(page);
});
