import type { Page } from "@playwright/test";
import { expect, expectNoA11yViolations, test } from "./fixtures";

/**
 * w-admin-registro on the read-only demo log (no Supabase in e2e): the
 * in-progress stage «jesolo» has 39 entries over today, yesterday and three
 * days ago (30 on the first page); «rimini» has none.
 */
async function apriRegistro(page: Page, query = "", id = "jesolo") {
  await page.goto(`/admin/tappe/${id}/registro${query}`);
  await expect(page.getByTestId("registro-tappa")).toBeVisible();
  await expect(page).toHaveTitle(
    "Registro dei punteggi · Amministrazione · BLVS",
  );
  // Client buttons hydrate after the streamed content.
  await page.waitForLoadState("networkidle");
}

function voci(page: Page) {
  return page.locator("[data-voce]").filter({ visible: true });
}

test("raggruppato per giorno, senza azioni di modifica, accessibile", async ({
  page,
}, testInfo) => {
  await apriRegistro(page);
  const giorni = page.getByTestId("registro-giorno");
  await expect(giorni.first().getByRole("heading", { level: 2 })).toHaveText(
    /^Oggi · /,
  );
  await expect(giorni.nth(1).getByRole("heading", { level: 2 })).toHaveText(
    /^Ieri · /,
  );
  await expect(voci(page)).toHaveCount(30);

  if (testInfo.project.name === "mobile-390") {
    // Cards with date, match and before → after; the table is hidden.
    await expect(page.locator("table").filter({ visible: true })).toHaveCount(
      0,
    );
    const scheda = voci(page).first();
    // The date and time is the card's title; match and values are labelled.
    await expect(scheda.locator("time")).toBeVisible();
    await expect(scheda.getByText("Partita", { exact: true })).toBeVisible();
    await expect(scheda.getByText("Prima → dopo")).toBeVisible();
  } else {
    const tabella = page.locator("table").filter({ visible: true }).first();
    await expect(tabella.locator("th[scope=col]")).toHaveCount(6);
    await expect(tabella.locator("th[scope=row]").first()).toBeVisible();
  }

  await expect(
    page.getByTestId("registro-tappa").getByRole("button"),
  ).toHaveText(["Applica i filtri", "Mostra le 9 voci precedenti"]);
  await expectNoA11yViolations(page);
});

test("«Mostra le N voci precedenti» carica il resto da tastiera", async ({
  page,
}) => {
  await apriRegistro(page);
  const pulsante = page.getByRole("button", {
    name: "Mostra le 9 voci precedenti",
  });
  await pulsante.focus();
  await page.keyboard.press("Enter");
  const annuncio = page.getByTestId("registro-annuncio");
  await expect(annuncio).toHaveText(
    "Caricate 9 voci precedenti. Non ci sono altre voci.",
  );
  await expect(annuncio).toBeFocused();
  await expect(voci(page)).toHaveCount(39);
  await expect(pulsante).toHaveCount(0);
  await expectNoA11yViolations(page);
});

test("filtri per tipo e per partita, nell'indirizzo", async ({ page }) => {
  await apriRegistro(page);
  await page.getByRole("combobox", { name: "Tipo" }).selectOption({
    label: "Correzione punteggio",
  });
  await page.getByRole("button", { name: "Applica i filtri" }).click();
  await expect(page).toHaveURL(/tipo=correzione_punteggio/);
  await expect(voci(page).first()).toBeVisible();
  const tipi = await voci(page).evaluateAll((els) =>
    els.map((el) => el.getAttribute("data-tipo")),
  );
  expect(new Set(tipi)).toEqual(new Set(["correzione_punteggio"]));
  await expect(
    page.getByRole("button", { name: /voci precedenti/ }),
  ).toHaveCount(0);

  await page.getByRole("combobox", { name: "Tipo" }).selectOption("");
  const partita = page.getByRole("combobox", { name: "Partita" });
  await partita.selectOption({ index: 1 });
  await page.getByRole("button", { name: "Applica i filtri" }).click();
  await expect(page).toHaveURL(/partita=/);
  await expect(page.getByText(/^Filtri:/)).toBeVisible();
  await expect(voci(page).first()).toBeVisible();

  await page.getByRole("link", { name: "Azzera i filtri" }).click();
  await expect(page).toHaveURL(/\/registro$/);
  await expect(voci(page)).toHaveCount(30);
});

test("registro vuoto", async ({ page }) => {
  await apriRegistro(page, "", "rimini");
  await expect(page.getByTestId("registro-vuoto")).toContainText(
    "Il registro è ancora vuoto",
  );
  await expectNoA11yViolations(page);
});

test("collegato dalla gestione della tappa", async ({ page }) => {
  await page.goto("/admin/tappe/jesolo");
  await page.getByRole("link", { name: "Registro dei punteggi" }).click();
  await expect(page).toHaveURL(/\/admin\/tappe\/jesolo\/registro$/);
  await expect(page.getByTestId("registro-tappa")).toBeVisible();
});
