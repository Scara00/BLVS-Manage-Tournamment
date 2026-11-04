import { readFile } from "node:fs/promises";
import type { APIRequestContext, Page } from "@playwright/test";
import { expect, expectNoA11yViolations, test } from "./fixtures";
import { waitForAnimations } from "./storybook-helpers";

/**
 * w-admin-iscritti / w-admin-aggiungi-giocatore on the in-memory demo data
 * (no Supabase in e2e). Each test creates its own stage through the
 * demo-only POST /api/demo/tappe: the server is shared by parallel projects
 * and reused across runs. A new demo stage has 5 men (seats 1–5, the first
 * is «Rossi Luca») and 3 women registered.
 */
async function creaTappa(
  request: APIRequestContext,
  body: { stato: string; posti?: number },
) {
  const response = await request.post("/api/demo/tappe", {
    data: { chiudonoIl: null, ...body },
  });
  expect(response.status()).toBe(201);
  return ((await response.json()) as { id: string }).id;
}

async function apriIscritti(page: Page, id: string) {
  await page.goto(`/admin/tappe/${id}/iscritti`);
  await expect(page.getByTestId("iscritti-tappa")).toBeVisible();
  await expect(page).toHaveTitle("Iscritti · Amministrazione · BLVS");
  // Client buttons hydrate after the streamed content.
  await page.waitForLoadState("networkidle");
}

function tabellone(page: Page, nome: string) {
  return page.getByRole("region", { name: nome });
}

test("aggiunta a mano di più giocatori senza account", async ({
  page,
  request,
}) => {
  const id = await creaTappa(request, { stato: "iscrizioni_chiuse", posti: 7 });
  await apriIscritti(page, id);
  // By test id: an open dialog hides the page from the accessibility tree.
  const m = page.getByTestId("tabellone-M");
  await expect(m.getByTestId("posti-liberi")).toHaveText("2 POSTI LIBERI");

  const trigger = page.getByRole("button", { name: "Aggiungi a mano" });
  await trigger.click();
  const dialog = page.getByRole("dialog", { name: "Aggiungi a mano" });
  await expect(dialog).toBeVisible();
  await waitForAnimations(page);
  await expectNoA11yViolations(page);

  const nome = dialog.getByRole("textbox", { name: /^Nome/ });
  const cognome = dialog.getByRole("textbox", { name: /^Cognome/ });
  const esito = dialog.getByRole("status");

  // Only the names change from one player to the next.
  await nome.fill("Mario");
  await cognome.fill("Verdi");
  await dialog.getByRole("radio", { name: "Maschile" }).click();
  await dialog.getByRole("button", { name: "Aggiungi" }).click();
  await expect(esito).toHaveText("Verdi Mario ora ha il posto 6.");
  await expect(nome).toBeFocused();
  await expect(m.getByTestId("posti-liberi")).toHaveText("1 POSTO LIBERO");

  await page.keyboard.type("Paolo");
  await page.keyboard.press("Tab");
  await page.keyboard.type("Neri");
  await page.keyboard.press("Enter");
  await expect(esito).toHaveText("Neri Paolo ora ha il posto 7.");
  await expect(m.getByTestId("posti-liberi")).toHaveText("NESSUN POSTO LIBERO");

  // Board full: refused, and the names stay to pick another category.
  await nome.fill("Ugo");
  await cognome.fill("Blu");
  await page.keyboard.press("Enter");
  await expect(dialog.getByRole("alert")).toHaveText(/Posti esauriti/);
  await expect(nome).toHaveValue("Ugo");
  await expectNoA11yViolations(page);

  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(trigger).toBeFocused();
  const riga = m.getByText("Verdi Mario").filter({ visible: true });
  await expect(riga).toBeVisible();
  await expect(
    m.getByText("Senza account").filter({ visible: true }),
  ).toHaveCount(2);
  await expect(page.getByText("@manuale.blvs.invalid")).toHaveCount(0);

  // A real player from now on: the search finds them for the next stage.
  await page.getByRole("button", { name: "Aggiungi giocatore" }).click();
  const ricerca = page.getByRole("dialog", { name: "Aggiungi giocatore" });
  await ricerca.getByRole("searchbox").fill("verdi mario");
  // The demo store is shared by the parallel projects: namesakes are other
  // people, so pick the one registered to this stage.
  await expect(
    ricerca.getByRole("button", {
      name: "Aggiungi Verdi Mario",
      description: "Già iscritto a questa tappa.",
    }),
  ).toBeVisible();
});

test("aggiunta di un giocatore da tastiera, anche a iscrizioni chiuse", async ({
  page,
  request,
}) => {
  const id = await creaTappa(request, { stato: "iscrizioni_chiuse", posti: 6 });
  await apriIscritti(page, id);

  const m = tabellone(page, "Tabellone maschile");
  await expect(m.getByTestId("posti-liberi")).toHaveText("1 POSTO LIBERO");
  await expect(
    tabellone(page, "Tabellone femminile").getByTestId("posti-liberi"),
  ).toHaveText("3 POSTI LIBERI");
  await expectNoA11yViolations(page);

  const trigger = page.getByRole("button", { name: "Aggiungi giocatore" });
  await trigger.focus();
  await page.keyboard.press("Enter");
  const dialog = page.getByRole("dialog", { name: "Aggiungi giocatore" });
  await expect(dialog).toBeVisible();
  await waitForAnimations(page);
  const ricerca = dialog.getByRole("searchbox", {
    name: /Cerca per nome, cognome o email/,
  });
  await expect(ricerca).toBeFocused();

  await page.keyboard.type("simone");
  const stato = dialog.getByRole("status");
  await expect(stato).toHaveText("1 giocatore trovato.");
  await expectNoA11yViolations(page);

  await page.keyboard.press("Tab");
  await expect(
    dialog.getByRole("button", { name: "Aggiungi Mancini Simone" }),
  ).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(dialog).toBeHidden();
  await expect(
    page.getByText("Mancini Simone ora ha il posto 6."),
  ).toBeVisible();
  await expect(trigger).toBeFocused();
  await expect(m.getByTestId("posti-liberi")).toHaveText("NESSUN POSTO LIBERO");
  await expect(
    m.getByText("Mancini Simone").filter({ visible: true }),
  ).toBeVisible();

  // The board is full now: another man cannot be added, and it says why.
  await page.keyboard.press("Enter");
  await expect(dialog).toBeVisible();
  await waitForAnimations(page);
  await page.keyboard.type("federico");
  await page.keyboard.press("Enter");
  await expect(stato).toHaveText("1 giocatore trovato.");
  await expect(
    dialog.getByRole("button", { name: "Aggiungi Fontana Federico" }),
  ).toHaveAccessibleDescription("Tabellone maschile al completo.");
  await expect(page).toHaveTitle("Iscritti · Amministrazione · BLVS");
  await expectNoA11yViolations(page);
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(trigger).toBeFocused();
});

test("rimozione con conferma: il posto torna libero", async ({
  page,
  request,
}) => {
  const id = await creaTappa(request, { stato: "iscrizioni_aperte", posti: 6 });
  await apriIscritti(page, id);
  const m = tabellone(page, "Tabellone maschile");

  const rimuovi = m
    .getByRole("button", { name: "Rimuovi Rossi Luca" })
    .filter({ visible: true });
  await rimuovi.focus();
  await page.keyboard.press("Enter");
  const dialog = page.getByRole("alertdialog", {
    name: "Rimuovere Rossi Luca dal posto 1?",
  });
  await expect(dialog).toBeVisible();
  await waitForAnimations(page);
  await expect(dialog.getByRole("button", { name: "Annulla" })).toBeFocused();
  await expectNoA11yViolations(page);

  // Esc changes nothing and gives focus back.
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(rimuovi).toBeFocused();

  await page.keyboard.press("Enter");
  await expect(dialog).toBeVisible();
  await waitForAnimations(page);
  await page.keyboard.press("Tab");
  await expect(dialog.getByRole("button", { name: "Rimuovi" })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(dialog).toBeHidden();

  const esito = m.getByTestId("iscritti-esito");
  await expect(esito).toHaveText(
    "Iscrizione di Rossi Luca rimossa: il posto 1 è di nuovo libero.",
  );
  await expect(esito).toBeFocused();
  await expect(m.getByTestId("posti-liberi")).toHaveText("2 POSTI LIBERI");
  await expect(
    m.getByRole("button", { name: "Rimuovi Rossi Luca" }),
  ).toHaveCount(0);
  // refresh() streams the metadata again: wait for the title before axe.
  await expect(page).toHaveTitle("Iscritti · Amministrazione · BLVS");
  await expectNoA11yViolations(page);
});

test("export CSV degli iscritti in UTF-8", async ({ page, request }) => {
  const id = await creaTappa(request, { stato: "iscrizioni_chiuse" });
  await apriIscritti(page, id);

  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "Esporta CSV" }).click(),
  ]);
  expect(download.suggestedFilename()).toMatch(
    /^iscritti-tappa-di-prova-.+\.csv$/,
  );
  const bytes = await readFile(await download.path());
  expect([...bytes.subarray(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
  const righe = bytes.toString("utf8").slice(1).trimEnd().split("\r\n");
  expect(righe[0]).toBe(
    "Categoria;Posto;Cognome e nome;Email;Stato;Iscritto il",
  );
  expect(righe).toHaveLength(1 + 5 + 3);
  expect(righe[1]).toMatch(
    /^Maschile;1;Rossi Luca;luca\.rossi@example\.it;Confermata;\d{2}\/\d{2}\/\d{4} \d{2}:\d{2}$/,
  );
  expect(righe.at(-1)).toMatch(/^Femminile;3;/);
});

test("una tappa in corso è in sola lettura; si arriva dalla gestione", async ({
  page,
  request,
}) => {
  const id = await creaTappa(request, { stato: "in_corso" });
  await page.goto(`/admin/tappe/${id}`);
  await expect(page.getByTestId("gestione-tappa")).toBeVisible();
  await page.waitForLoadState("networkidle");
  await page.getByRole("link", { name: "Gestisci iscritti" }).click();
  await expect(page).toHaveURL(new RegExp(`/admin/tappe/${id}/iscritti$`));
  await expect(page.getByTestId("iscritti-tappa")).toBeVisible();

  await expect(
    page.getByText(/in corso o conclusa gli iscritti non cambiano più/),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Aggiungi giocatore" }),
  ).toHaveCount(0);
  await expect(page.getByRole("button", { name: /^Rimuovi/ })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Esporta CSV" })).toBeVisible();
  await expectNoA11yViolations(page);
});

test("/admin/iscrizioni elenca le tappe con il link agli iscritti", async ({
  page,
}) => {
  await page.goto("/admin/iscrizioni");
  const link = page
    .getByRole("link", { name: "Iscritti di Tappa 2 · Rimini" })
    .filter({ visible: true });
  await expect(link).toHaveAttribute("href", "/admin/tappe/rimini/iscritti");
  await expectNoA11yViolations(page);
});
