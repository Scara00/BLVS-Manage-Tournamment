import type { APIRequestContext } from "@playwright/test";
import { expect, expectNoA11yViolations, test } from "./fixtures";
import { waitForAnimations } from "./storybook-helpers";

/**
 * w-admin-giocatori, w-admin-giocatore and w-admin-categoria-conferma
 * (BLVS-54). Each test creates its own player through the demo-only POST
 * /api/demo/giocatori: a men's player to verify, registered to two future
 * stages (the women's board of the first is full, on the second he is in
 * a proposed group). With `inCorso` a stage in progress blocks the change.
 */
async function creaGiocatore(request: APIRequestContext, inCorso = false) {
  const response = await request.post("/api/demo/giocatori", {
    data: { inCorso },
  });
  expect(response.status()).toBe(201);
  return (await response.json()) as { utenteId: string; nome: string };
}

test("elenco: ricerca e filtro da verificare, poi la scheda, axe", async ({
  page,
  request,
}) => {
  const { utenteId, nome } = await creaGiocatore(request);
  const cognomeNome = nome.split(" ").reverse().join(" ");

  await page.goto("/admin/giocatori");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Giocatori");
  await expectNoA11yViolations(page);

  await page.getByRole("searchbox", { name: /Cerca/ }).fill(nome);
  await page.getByText("Solo categoria da verificare").click();
  await page.getByRole("button", { name: "Cerca", exact: true }).click();
  await expect(page).toHaveURL(/verifica=1/);
  await expect(page.getByTestId("giocatori-totale")).toHaveText(
    `1 giocatore da verificare per «${nome}»`,
  );
  const riga = page
    .locator(`[data-giocatore="${utenteId}"]`)
    .filter({ visible: true });
  await expect(riga).toContainText("Da verificare");
  await expectNoA11yViolations(page);

  await riga.getByRole("link", { name: cognomeNome }).click();
  await expect(page).toHaveURL(`/admin/giocatori/${utenteId}`);
  await expect(page.getByTestId("scheda-categoria")).toHaveText("Maschile");
  await expect(
    page.locator("[data-tappa]").filter({ visible: true }),
  ).toHaveCount(2);
  await expectNoA11yViolations(page);

  // «Segna come verificata»: the badge changes, the outcome stays as text.
  await page
    .getByRole("button", { name: "Segna la categoria come verificata" })
    .click();
  await expect(page.getByTestId("esito-verifica")).toHaveText(
    "Categoria segnata come verificata.",
  );
  await expect(page.locator('[data-verifica="verificata"]')).toBeVisible();
});

test("cambio di categoria da tastiera: effetti, Esc, conferma, esito", async ({
  page,
  request,
}) => {
  const { utenteId, nome } = await creaGiocatore(request);
  await page.goto(`/admin/giocatori/${utenteId}`);
  await page.waitForLoadState("networkidle");

  const bottone = page.getByRole("button", { name: "Cambia in femminile" });
  await bottone.focus();
  await page.keyboard.press("Enter");
  const dialog = page.getByTestId("cambio-categoria-dialog");
  await expect(dialog).toBeVisible();
  await expect(
    dialog.getByRole("heading", {
      name: `Cambiare la categoria di ${nome} in femminile?`,
    }),
  ).toBeVisible();
  // Focus starts on the safe choice.
  await expect(dialog.getByRole("button", { name: "Annulla" })).toBeFocused();
  const iscrizioni = dialog.getByTestId("cambio-effetti-iscrizioni");
  await expect(iscrizioni.locator("li")).toHaveCount(2);
  await expect(iscrizioni).toContainText(
    "dal posto 7 del tabellone maschile al posto 17 del femminile, oltre il massimo di 16 posti",
  );
  await expect(iscrizioni).toContainText(
    "dal posto 3 del tabellone maschile al posto 6 di 16 del femminile. Esce dai gironi già proposti",
  );
  await expect(dialog.getByTestId("cambio-effetti-punti")).toContainText(
    "Nessun punto in classifica generale da spostare.",
  );
  await waitForAnimations(page);
  await expectNoA11yViolations(page);

  // Esc changes nothing and gives focus back to the button.
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(bottone).toBeFocused();
  await expect(page.getByTestId("scheda-categoria")).toHaveText("Maschile");

  // Reopen and confirm with the keyboard only.
  await page.keyboard.press("Enter");
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Annulla" })).toBeFocused();
  // The note sits before the footer: Shift+Tab reaches it.
  await page.keyboard.press("Shift+Tab");
  await expect(dialog.getByRole("textbox")).toBeFocused();
  await page.keyboard.type("Categoria sbagliata alla registrazione");
  await page.keyboard.press("Tab");
  await page.keyboard.press("Tab");
  await expect(
    dialog.getByRole("button", { name: "Sì, cambia in femminile" }),
  ).toBeFocused();
  await page.keyboard.press("Enter");

  const esito = page.getByTestId("esito-cambio-categoria");
  await expect(esito).toHaveText(
    `Categoria di ${nome} cambiata in Femminile. 2 iscrizioni spostate nel tabellone femminile.`,
  );
  await expect(esito).toBeFocused();
  await expect(dialog).toBeHidden();
  await expect(page.getByTestId("scheda-categoria")).toHaveText("Femminile");
  await expect(
    page.locator('[data-tappa][data-categoria="F"]').filter({ visible: true }),
  ).toHaveCount(2);
  await waitForAnimations(page);
  await expectNoA11yViolations(page);
});

test("una tappa in corso blocca il cambio", async ({ page, request }) => {
  const { utenteId } = await creaGiocatore(request, true);
  await page.goto(`/admin/giocatori/${utenteId}`);
  await page.getByRole("button", { name: "Cambia in femminile" }).click();
  const dialog = page.getByTestId("cambio-categoria-dialog");
  await expect(dialog.getByTestId("cambio-categoria-bloccato")).toContainText(
    "in corso: la categoria si potrà cambiare quando la tappa sarà conclusa",
  );
  await expect(dialog.getByRole("button", { name: /Sì, cambia/ })).toHaveCount(
    0,
  );
  await waitForAnimations(page);
  await expectNoA11yViolations(page);
});
