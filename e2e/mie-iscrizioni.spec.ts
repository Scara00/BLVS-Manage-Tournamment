import type { Page } from "@playwright/test";
import { expect, expectNoA11yViolations, test } from "./fixtures";
import { waitForAnimations } from "./storybook-helpers";

/*
 * w-mie-iscrizioni and w-annulla-iscrizione (BLVS-51) on the demo data.
 * `POST /api/demo/mie-iscrizioni` registers this browser's demo player
 * (cookie) to two fresh stages: Sabaudia can still be cancelled,
 * Sottomarina is past its cancel deadline. Past stages and the season
 * summary come from the overall standing demo (BLVS-44).
 */

type Fixture = { annullabile: string; scaduta: string };

async function iscrizioni(page: Page): Promise<Fixture> {
  const res = await page.request.post("/api/demo/mie-iscrizioni");
  expect(res.status()).toBe(201);
  return (await res.json()) as Fixture;
}

function card(page: Page, tappaId: string) {
  return page.locator(
    `[data-testid="iscrizione-mia"][data-tappa="${tappaId}"]`,
  );
}

test("elenco: prossime e passate, stato a testo, riepilogo della stagione", async ({
  page,
}) => {
  const { annullabile, scaduta } = await iscrizioni(page);
  await page.goto("/iscrizioni");
  await expect(
    page.getByRole("heading", { level: 1, name: "Le mie iscrizioni" }),
  ).toBeVisible();

  const prossime = page.getByRole("region", { name: "Prossime tappe" });
  await expect(prossime.locator(card(page, annullabile))).toBeVisible();
  await expect(prossime.locator(card(page, scaduta))).toBeVisible();

  const sabaudia = card(page, annullabile);
  await expect(sabaudia.getByTestId("stato-iscrizione")).toHaveText("Iscritto");
  await expect(sabaudia.getByTestId("posto")).toHaveText("10 · Maschile");
  await expect(
    sabaudia.getByRole("button", { name: "Annulla l'iscrizione" }),
  ).toBeVisible();

  // Past the deadline: no action, a text says why.
  const sottomarina = card(page, scaduta);
  await expect(sottomarina.getByRole("button")).toHaveCount(0);
  await expect(
    sottomarina.getByTestId("annullamento-non-possibile"),
  ).toContainText("Non puoi più annullare: la scadenza era il");

  // Past stages with their result, from the stage standings.
  const passate = page.getByRole("region", { name: "Tappe passate" });
  await expect(passate.getByTestId("iscrizione-mia").first()).toBeVisible();
  await expect(passate.getByTestId("risultato").first()).toContainText(
    /posto · \d+ punt/,
  );

  const stagione = page.getByRole("region", { name: /La tua stagione \d{4}/ });
  await expect(stagione.getByTestId("stagione-punti")).toHaveText(/^\d+$/);
  await expect(stagione.getByTestId("stagione-tappe")).toHaveText(/^\d+$/);
  await expect(stagione.getByTestId("stagione-posizione")).toContainText("°");

  // The state is never colour alone: every card says it in words.
  for (const stato of await page.getByTestId("stato-iscrizione").all()) {
    await expect(stato).toHaveText(/\S/);
  }
  await expectNoA11yViolations(page);
});

test("annullamento da tastiera: focus su «Mantieni», Esc, poi conferma e posto libero", async ({
  page,
}) => {
  const { annullabile } = await iscrizioni(page);

  // Counters before: 9 others + the demo player on 16 seats.
  await page.goto(`/tappe/${annullabile}`);
  await expect(page.getByRole("region", { name: /Maschile/ })).toContainText(
    "6 liberi su 16",
  );

  await page.goto("/iscrizioni");
  await page.waitForLoadState("networkidle");
  const sabaudia = card(page, annullabile);
  const apri = sabaudia.getByRole("button", { name: "Annulla l'iscrizione" });
  await apri.focus();
  await page.keyboard.press("Enter");

  const dialog = page.getByRole("alertdialog");
  await expect(dialog).toBeVisible();
  const mantieni = dialog.getByRole("button", {
    name: "Mantieni l'iscrizione",
  });
  await expect(mantieni).toBeFocused();
  await expect(dialog.getByTestId("annulla-conseguenze")).toContainText(
    "Il posto 10 nel maschile torna libero",
  );
  await waitForAnimations(page);
  await expectNoA11yViolations(page);

  // Esc keeps the registration and gives focus back.
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(apri).toBeFocused();

  // Enter, Tab to the destructive action, Enter.
  await page.keyboard.press("Enter");
  await expect(mantieni).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(
    dialog.getByRole("button", { name: "Annulla l'iscrizione" }),
  ).toBeFocused();
  await page.keyboard.press("Enter");

  await expect(dialog).toBeHidden();
  const esito = page.getByTestId("esito-annullamento");
  await expect(esito).toContainText(
    "Iscrizione a Tappa di prova · Sabaudia annullata: il posto 10 è di nuovo libero.",
  );
  await expect(esito).toBeFocused();
  await expect(sabaudia.getByTestId("stato-iscrizione")).toHaveText(
    "Iscrizione annullata",
  );
  await expect(sabaudia.getByRole("button")).toHaveCount(0);
  await waitForAnimations(page);
  await expectNoA11yViolations(page);

  // The seat is free again and the counters follow.
  await page.goto(`/tappe/${annullabile}`);
  await expect(page.getByRole("region", { name: /Maschile/ })).toContainText(
    "7 liberi su 16",
  );
  await expect(
    page.getByRole("button", { name: "Prendi il posto 10 nel maschile" }),
  ).toBeEnabled();
});

test("da w-tappa: annulla e torna a «Prendi il posto»", async ({ page }) => {
  const { annullabile, scaduta } = await iscrizioni(page);

  // Past the deadline the stage page has no action either.
  await page.goto(`/tappe/${scaduta}`);
  await expect(
    page.getByRole("button", { name: "Annulla l'iscrizione" }),
  ).toHaveCount(0);
  await expect(page.getByTestId("annullamento-non-possibile")).toBeVisible();

  await page.goto(`/tappe/${annullabile}`);
  await page.waitForLoadState("networkidle");
  await expect(page.getByText(/Hai il posto\s*10/)).toBeVisible();
  await page.getByRole("button", { name: "Annulla l'iscrizione" }).click();
  const dialog = page.getByRole("alertdialog");
  await dialog.getByRole("button", { name: "Annulla l'iscrizione" }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByTestId("esito-annullamento")).toBeFocused();
  await expect(page.getByRole("region", { name: /Maschile/ })).toContainText(
    "7 liberi su 16",
  );
  await expect(
    page.getByRole("button", { name: "Prendi il posto 10 nel maschile" }),
  ).not.toHaveAttribute("aria-disabled", "true");
  await waitForAnimations(page);
  await expectNoA11yViolations(page);
});
