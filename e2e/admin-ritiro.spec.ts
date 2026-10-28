import type { APIRequestContext, Page } from "@playwright/test";
import { expect, expectNoA11yViolations, test } from "./fixtures";
import { waitForAnimations } from "./storybook-helpers";

/**
 * w-admin-ritiro and w-admin-impatto-fase (BLVS-42) inside w-admin-live.
 * Each test creates its own stage through the demo-only POST
 * /api/demo/ritiro: the men's board is started, and with
 * `faseSuccessiva` a next phase with one scored final already exists.
 */
async function creaTappa(request: APIRequestContext, faseSuccessiva = false) {
  const response = await request.post("/api/demo/ritiro", {
    data: { faseSuccessiva },
  });
  expect(response.status()).toBe(201);
  return (await response.json()) as { id: string; gironeId: string };
}

async function apriRitiro(page: Page, id: string, gironeId: string) {
  await page.goto(`/admin/tappe/${id}/live/m`);
  await expect(page.getByTestId("admin-live")).toBeVisible();
  await page.waitForLoadState("networkidle");
  await page
    .getByTestId(`ritiro-girone-${gironeId}`)
    .getByRole("button", { name: /^Ritiro o assenza:/ })
    .click();
  const dialog = page.getByTestId("ritiro-dialog");
  await expect(dialog).toBeVisible();
  await expect(dialog.locator("*:focus")).toHaveCount(1);
  await waitForAnimations(page);
  return dialog;
}

test("errori accanto ai campi, anteprima, registrazione e registro, axe", async ({
  page,
  request,
}) => {
  const { id, gironeId } = await creaTappa(request);
  const dialog = await apriRitiro(page, id, gironeId);
  await expectNoA11yViolations(page);

  // Submitted empty: each error next to its field, focus on the first.
  await dialog
    .getByRole("button", { name: "Registra ritiro o assenza" })
    .click();
  const giocatore = dialog.getByRole("combobox", { name: /Giocatore/ });
  await expect(giocatore).toBeFocused();
  await expect(giocatore).toHaveAttribute("aria-invalid", "true");
  await expect(giocatore).toHaveAccessibleDescription(/Scegli il giocatore/);
  await expect(dialog.getByTestId("ritiro-partite")).toContainText(
    "Scegli almeno una partita.",
  );
  await expectNoA11yViolations(page);

  const nome = await giocatore.locator("option").nth(1).textContent();
  await giocatore.selectOption({ index: 1 });
  await dialog.getByRole("radio", { name: /Ritiro/ }).click();
  await expect(dialog.getByRole("checkbox", { checked: true })).toHaveCount(3);
  await expect(dialog.getByTestId("ritiro-regola")).toContainText(
    "viene annullata",
  );
  await expect(
    dialog.getByTestId("ritiro-anteprima").locator("li"),
  ).toHaveCount(3);
  await expect(dialog.getByTestId("ritiro-classifica")).toContainText(
    `${nome} (ritirato)`,
  );
  await expectNoA11yViolations(page);

  await dialog
    .getByRole("button", { name: "Registra il ritiro (3 partite)" })
    .click();
  const esito = page.getByTestId("admin-live-esito");
  await expect(esito).toContainText(`Ritiro registrato per ${nome}`);
  await expect(esito).toBeFocused();
  const gruppo = page.getByTestId(`ritiro-girone-${gironeId}`);
  await expect(gruppo).toContainText(`${nome}`);
  await expect(gruppo.getByTestId("nota-assenza")).toHaveText("Ritirato");
  await expect(page).toHaveTitle(/Gestione live/);
  // The dialog fades out after the success: axe reads it mid-fade.
  await expect(page.getByTestId("ritiro-dialog")).toBeHidden();
  await waitForAnimations(page);
  await expectNoA11yViolations(page);

  await page.goto(`/admin/tappe/${id}/registro`);
  const registro = page.getByTestId("registro-tappa");
  await expect(registro).toBeVisible();
  await expect(
    registro.getByText(`Ritiro di ${nome}`).filter({ visible: true }).first(),
  ).toBeVisible();
});

test("da tastiera: con la fase successiva si apre il dialog di impatto", async ({
  page,
  request,
}) => {
  const { id, gironeId } = await creaTappa(request, true);
  const dialog = await apriRitiro(page, id, gironeId);

  await dialog.getByRole("combobox", { name: /Giocatore/ }).selectOption({
    index: 1,
  });
  await dialog.getByRole("radio", { name: /Assenza/ }).focus();
  await page.keyboard.press("Space");
  await dialog.getByRole("checkbox").first().focus();
  await page.keyboard.press("Space");
  await dialog
    .getByRole("button", { name: "Registra l'assenza (1 partita)" })
    .focus();
  await page.keyboard.press("Enter");

  const impatto = page.getByRole("alertdialog", {
    name: "La fase successiva è già generata",
  });
  await expect(impatto).toBeVisible();
  await expect(impatto.locator("*:focus")).toHaveCount(1);
  await expect(impatto).toContainText("dopo l'assenza");
  await waitForAnimations(page);
  await expectNoA11yViolations(page);

  await impatto.getByRole("button", { name: "Mantieni" }).focus();
  await page.keyboard.press("Enter");
  const esito = page.getByTestId("admin-live-esito");
  await expect(esito).toContainText("Assenza registrata");
  await expect(esito).toContainText("La fase successiva resta com'era.");
  await expect(
    page.getByTestId(`ritiro-girone-${gironeId}`).getByTestId("nota-assenza"),
  ).toHaveText("Assente in 1 partita");
});
