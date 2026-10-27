import type { APIRequestContext, Page } from "@playwright/test";
import { expect, expectNoA11yViolations, test } from "./fixtures";
import { waitForAnimations } from "./storybook-helpers";

/**
 * w-admin-correzione and w-admin-impatto-fase (BLVS-41). Each test creates
 * its own stage through the demo-only POST /api/demo/correzione-punteggio:
 * every men's group match is scored and two finals already exist, one
 * with a score.
 */
async function creaTappa(request: APIRequestContext) {
  const response = await request.post("/api/demo/correzione-punteggio", {
    data: { punteggi: 1 },
  });
  expect(response.status()).toBe(201);
  return ((await response.json()) as { id: string }).id;
}

const campo = (page: Page, n: 0 | 1) =>
  page.getByRole("textbox").filter({ visible: true }).nth(n);

/** Opens the first match of the stage, already scored: a correction. */
async function apriCorrezione(page: Page, id: string) {
  await page.goto(`/admin/tappe/${id}/punteggi`);
  await expect(page.getByTestId("elenco-punteggi")).toBeVisible();
  const link = page
    .getByRole("link", { name: /^Correggi il punteggio:/ })
    .first();
  const href = await link.getAttribute("href");
  await page.goto(href!);
  await expect(page.getByTestId("inserimento-punteggio")).toBeVisible();
  await page.waitForLoadState("networkidle");
  return href!;
}

test("confronto barrato, «Cosa cambia» e «non chiude il set», axe", async ({
  page,
  request,
}) => {
  const id = await creaTappa(request);
  await apriCorrezione(page, id);
  const sezione = page.getByTestId("cosa-cambia").first();
  await expect(sezione.getByTestId("valore-precedente")).toHaveText("21–18");

  await campo(page, 0).fill("21");
  await campo(page, 1).fill("20");
  await expect(sezione).toContainText("21–20 non chiude il set");
  await expect(page.getByTestId("annuncio-cosa-cambia")).toContainText(
    "non chiude il set",
  );
  await expectNoA11yViolations(page);

  await campo(page, 0).fill("10");
  await campo(page, 1).fill("21");
  await expect(sezione.getByTestId("valore-nuovo")).toHaveText("10–21");
  await expect(sezione).toContainText("Il vincitore cambia");
  await expectNoA11yViolations(page);
});

test("da tastiera: «Rigenera» senza spunta, poi conferma", async ({
  page,
  request,
}) => {
  const id = await creaTappa(request);
  const href = await apriCorrezione(page, id);
  await campo(page, 0).fill("10");
  await campo(page, 1).fill("21");
  await page.getByRole("button", { name: "Vai al riepilogo" }).click();
  await page.getByRole("button", { name: "Conferma e salva" }).click();

  const dialog = page.getByRole("alertdialog", {
    name: "La fase successiva è già generata",
  });
  await expect(dialog).toBeVisible();
  await expect(dialog.locator("*:focus")).toHaveCount(1);
  await expect(dialog.getByRole("button", { name: "Annulla" })).toBeFocused();
  await expect(dialog.getByTestId("anteprima-fase").locator("li")).toHaveCount(
    2,
  );
  await expect(dialog.getByTestId("punteggi-persi")).toHaveText(
    "Rigenerando perdi 1 punteggio già inserito.",
  );
  // The footer is always on screen, even when the body scrolls.
  await expect(
    dialog.getByRole("button", { name: "Rigenera" }),
  ).toBeInViewport();
  await waitForAnimations(page);
  await expectNoA11yViolations(page);

  const rigenera = dialog.getByRole("button", { name: "Rigenera" });
  for (let i = 0; i < 6; i++) {
    if (await rigenera.evaluate((el) => el === document.activeElement)) break;
    await page.keyboard.press("Tab");
  }
  await expect(rigenera).toBeFocused();
  await page.keyboard.press("Enter");

  const casella = dialog.getByRole("checkbox");
  await expect(casella).toBeFocused();
  await expect(dialog.getByTestId("card-rigenera")).toContainText(
    "Spunta la casella per confermare che perdi 1 punteggio.",
  );
  await expectNoA11yViolations(page);

  await page.keyboard.press("Space");
  await expect(casella).toBeChecked();
  for (let i = 0; i < 10; i++) {
    if (await rigenera.evaluate((el) => el === document.activeElement)) break;
    await page.keyboard.press("Tab");
  }
  await page.keyboard.press("Enter");

  await expect(dialog).toBeHidden();
  const esito = page.getByTestId("esito-punteggio");
  await expect(esito).toContainText("Punteggio corretto");
  await expect(esito).toContainText("perso 1 punteggio");
  await expect(esito).toBeFocused();

  await page.goto(href);
  await expect(page.getByTestId("punteggio-attuale")).toContainText("10–21");
});

test("«Mantieni» corregge e la fase successiva resta", async ({
  page,
  request,
}) => {
  const id = await creaTappa(request);
  const href = await apriCorrezione(page, id);
  await campo(page, 0).fill("10");
  await campo(page, 1).fill("21");
  await page.getByRole("button", { name: "Vai al riepilogo" }).click();
  await page.getByRole("button", { name: "Conferma e salva" }).click();
  const dialog = page.getByRole("alertdialog", {
    name: "La fase successiva è già generata",
  });
  await expect(dialog.locator("*:focus")).toHaveCount(1);
  await dialog.getByRole("button", { name: "Mantieni" }).click();
  await expect(page.getByTestId("esito-punteggio")).toContainText(
    "La fase successiva resta com'era.",
  );

  // A second correction still meets the next phase.
  await page.goto(href);
  await campo(page, 0).fill("21");
  await campo(page, 1).fill("12");
  await page.getByRole("button", { name: "Vai al riepilogo" }).click();
  await page.getByRole("button", { name: "Conferma e salva" }).click();
  await expect(dialog).toBeVisible();
});
