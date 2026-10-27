import type { APIRequestContext, Locator, Page } from "@playwright/test";
import { expect, expectNoA11yViolations, test } from "./fixtures";
import { waitForAnimations } from "./storybook-helpers";

/**
 * w-admin-tappa / w-admin-stato-conferma on the in-memory demo stages (no
 * Supabase in e2e). Each test creates its own stage through the demo-only
 * POST /api/demo/tappe, because the server is shared by parallel projects
 * and reused across runs.
 */
const DAY = 24 * 60 * 60 * 1000;
const CRON_SECRET = "e2e-cron-secret"; // playwright.config.ts webServer env

async function creaTappa(
  request: APIRequestContext,
  body: { stato?: string; chiudonoIl: string | null; nome?: string },
) {
  const response = await request.post("/api/demo/tappe", { data: body });
  expect(response.status()).toBe(201);
  return ((await response.json()) as { id: string }).id;
}

function inGiorni(days: number) {
  return new Date(new Date().getTime() + days * DAY).toISOString();
}

async function apriGestione(page: Page, id: string) {
  await page.goto(`/admin/tappe/${id}`);
  await expect(page.getByTestId("gestione-tappa")).toBeVisible();
  // Client buttons hydrate after the streamed content.
  await page.waitForLoadState("networkidle");
}

/** ResponsiveTable: a table from `md`, a list of cards below. */
function tabella(page: Page, name: string) {
  return page.getByRole("table", { name }).or(page.getByRole("list", { name }));
}

function flusso(page: Page) {
  return page.getByRole("list", { name: "Stato delle iscrizioni" });
}

/** The current step: by `aria-current` and by its visible words. */
async function expectPassoAttuale(page: Page, label: string) {
  const attuale = flusso(page).locator('li[aria-current="step"]');
  await expect(attuale).toHaveCount(1);
  await expect(attuale).toContainText(label);
  await expect(attuale).toContainText("Stato attuale");
}

/** Every step names itself and its position in words, not only in colour. */
async function expectStatoATesto(page: Page) {
  const passi = flusso(page).getByRole("listitem");
  await expect(passi).toHaveCount(3);
  for (const [i, label] of [
    "Bozza",
    "Iscrizioni aperte",
    "Iscrizioni chiuse",
  ].entries()) {
    const passo = passi.nth(i);
    await expect(passo).toContainText(String(i + 1));
    await expect(passo).toContainText(label);
    await expect(passo).toContainText(/Completato|Stato attuale|Da fare/);
  }
}

async function confermaDaTastiera(page: Page, trigger: Locator, nome: string) {
  await trigger.focus();
  await page.keyboard.press("Enter");
  const dialog = page.getByRole("alertdialog", { name: nome });
  await expect(dialog).toBeVisible();
  await waitForAnimations(page);
  await expect(dialog.getByRole("button", { name: "Annulla" })).toBeFocused();
  await page.keyboard.press("Tab");
  await page.keyboard.press("Enter");
  await expect(dialog).toBeHidden();
  await expect(page.getByRole("alertdialog")).toHaveCount(0);
}

test("flusso bozza › aperte › chiuse con conferma da tastiera", async ({
  page,
  request,
}) => {
  const id = await creaTappa(request, { chiudonoIl: inGiorni(5) });
  await apriGestione(page, id);

  await expect(page).toHaveTitle("Gestione tappa · Amministrazione · BLVS");
  await expectStatoATesto(page);
  await expectPassoAttuale(page, "Bozza");
  await expect(page.getByTestId("scadenza-iscrizioni")).toContainText(
    "alla chiusura",
  );
  await expect(tabella(page, "Tabelloni")).toContainText("Femminile");
  await expectNoA11yViolations(page);

  // Esc closes without changes and gives focus back to the button.
  const apri = page.getByRole("button", { name: "Apri le iscrizioni" });
  await apri.focus();
  await page.keyboard.press("Enter");
  const dialog = page.getByRole("alertdialog", {
    name: "Aprire le iscrizioni?",
  });
  await expect(dialog).toBeVisible();
  await waitForAnimations(page);
  await expect(dialog).toContainText(
    "La tappa diventerà visibile ai giocatori",
  );
  const confronto = dialog.getByRole("table", { name: "Cosa cambia" });
  await expect(
    confronto.getByRole("row", { name: /Visibile ai giocatori/ }),
  ).toContainText("No, è una bozza");
  await expect(dialog.getByRole("button", { name: "Annulla" })).toBeFocused();
  await expectNoA11yViolations(page);
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(apri).toBeFocused();
  await expectPassoAttuale(page, "Bozza");

  await confermaDaTastiera(page, apri, "Aprire le iscrizioni?");
  await expectPassoAttuale(page, "Iscrizioni aperte");
  await expect(
    page.getByText("Iscrizioni aperte: la tappa è visibile ai giocatori."),
  ).toBeVisible();

  // Scoped to the page: the closing dialog fades out with its own button.
  const chiudi = page
    .getByTestId("gestione-tappa")
    .getByRole("button", { name: "Chiudi le iscrizioni" });
  await expect(chiudi).toBeFocused();
  await confermaDaTastiera(page, chiudi, "Chiudere le iscrizioni adesso?");
  await expectPassoAttuale(page, "Iscrizioni chiuse");
  await expect(page.getByTestId("scadenza-iscrizioni")).toContainText(
    "Iscrizioni chiuse a mano",
  );
  await expect(
    page.getByText("Non ci sono altri passaggi di stato da questa pagina."),
  ).toBeFocused();
  await expectStatoATesto(page);
  // refresh() streams the metadata again: wait for the title to be back.
  await expect(page).toHaveTitle("Gestione tappa · Amministrazione · BLVS");
  // The toast fades in: axe would read its colours mid-animation.
  await waitForAnimations(page);
  await expectNoA11yViolations(page);
});

test("una bozza senza scadenza si apre solo dopo averla impostata", async ({
  page,
  request,
}) => {
  const id = await creaTappa(request, { chiudonoIl: null });
  await apriGestione(page, id);

  const apri = page.getByRole("button", { name: "Apri le iscrizioni" });
  await expect(apri).toHaveAttribute("aria-disabled", "true");
  await expect(apri).toHaveAccessibleDescription(/Imposta prima la scadenza/);
  await expectNoA11yViolations(page);

  const scadenza = new Date(new Date().getTime() + 10 * DAY);
  const pad = (n: number) => String(n).padStart(2, "0");
  // The demo stage starts in 2099: any date in the next weeks is valid.
  const valore = `${scadenza.getFullYear()}-${pad(scadenza.getMonth() + 1)}-${pad(scadenza.getDate())}T18:00`;
  await page.getByLabel("Scadenza delle iscrizioni").fill(valore);
  await page.getByRole("button", { name: "Salva la scadenza" }).click();
  await expect(
    page.getByText("Scadenza delle iscrizioni aggiornata."),
  ).toBeVisible();
  await expect(page.getByTestId("scadenza-iscrizioni")).toContainText(
    /Chiusura tra \d+ giorni/,
  );
  await expect(apri).not.toHaveAttribute("aria-disabled", "true");
});

test("una scadenza passata viene rifiutata sul campo", async ({
  page,
  request,
}) => {
  const id = await creaTappa(request, { chiudonoIl: inGiorni(5) });
  await apriGestione(page, id);

  const campo = page.getByLabel("Scadenza delle iscrizioni");
  await campo.fill("2020-01-01T10:00");
  await page.getByRole("button", { name: "Salva la scadenza" }).click();
  await expect(campo).toHaveAttribute("aria-invalid", "true");
  await expect(campo).toBeFocused();
  await expect(campo).toHaveAccessibleDescription(/nel futuro/);
  await expectNoA11yViolations(page);
});

test("il job lato server chiude le iscrizioni alla scadenza e la pagina lo dice", async ({
  page,
  request,
}) => {
  const id = await creaTappa(request, {
    stato: "iscrizioni_aperte",
    chiudonoIl: inGiorni(-1),
  });

  const senzaSegreto = await request.get("/api/cron/chiudi-iscrizioni");
  expect(senzaSegreto.status()).toBe(401);

  const job = await request.get("/api/cron/chiudi-iscrizioni", {
    headers: { authorization: `Bearer ${CRON_SECRET}` },
  });
  expect(job.status()).toBe(200);
  // A parallel test (or a page read) may have closed it first.
  expect(typeof (await job.json()).chiuse).toBe("number");

  await apriGestione(page, id);
  await expectPassoAttuale(page, "Iscrizioni chiuse");
  await expect(page.getByTestId("scadenza-iscrizioni")).toContainText(
    "Iscrizioni chiuse automaticamente alla scadenza",
  );
  await expect(page.getByRole("button", { name: /iscrizioni/ })).toHaveCount(0);
  await expectNoA11yViolations(page);
});

test("elenco tappe: ogni tappa porta alla sua gestione", async ({ page }) => {
  await page.goto("/admin/tappe");
  const elenco = tabella(page, "Tappe del circuito");
  await expect(elenco).toBeVisible();
  await expect(elenco).toContainText("Bozza");
  await expectNoA11yViolations(page);

  await page.getByRole("link", { name: /Tappa 2 · Rimini/ }).click();
  await expect(page).toHaveURL(/\/admin\/tappe\/rimini$/);
  await expect(
    page.getByRole("heading", { level: 2, name: "Tappa 2 · Rimini" }),
  ).toBeVisible();
});

test("una tappa che non esiste mostra la pagina 404", async ({ page }) => {
  await page.goto("/admin/tappe/non-esiste");
  await expect(
    page.getByRole("heading", { level: 1, name: "Pagina non trovata" }),
  ).toBeVisible();
  await expectNoA11yViolations(page);
});
