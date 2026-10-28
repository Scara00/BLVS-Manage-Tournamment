import type { APIRequestContext, Page } from "@playwright/test";
import { expect, expectNoA11yViolations, test } from "./fixtures";

/*
 * w-giocatore (BLVS-50) end to end, on the demo data (no Supabase env).
 * Each test creates its own hidden season through the e2e fixture
 * POST /api/demo/classifica-generale (TAPPE_DEMO_SEED=true), like
 * classifica-generale.spec.ts. Demo M player 8 is a deleted account.
 * The two projects (mobile-390, desktop-1440) run axe at both widths.
 *
 * Never wait for "networkidle": the SSE stream keeps a request open.
 */

const ME = "demo-u-m-01";
const ANONIMO = "demo-u-m-08";

type Scenario = { stagione: number; categoria: "M"; tappaAperta: string };

async function creaScenario(request: APIRequestContext): Promise<Scenario> {
  const res = await request.post("/api/demo/classifica-generale", {
    data: {},
  });
  expect(res.status()).toBe(201);
  return (await res.json()) as Scenario;
}

async function waitForLive(page: Page) {
  await expect(
    page.getByRole("region", { name: "Stato degli aggiornamenti" }),
  ).toHaveAttribute("data-status", "live", { timeout: 10_000 });
}

async function apriScheda(page: Page, id: string, { stagione }: Scenario) {
  await page.goto(
    `/classifica/giocatore/${id}?categoria=M&stagione=${stagione}`,
  );
  await expect(page.getByTestId("scheda-giocatore")).toBeVisible();
  await waitForLive(page);
}

/** The visible view of the stage table (table at 1440, cards at 390). */
const righeTappe = (page: Page) =>
  page.locator("[data-testid^='tappa-']").filter({ visible: true });

test("dalla classifica generale il nome apre la scheda del giocatore", async ({
  page,
  request,
}) => {
  const scenario = await creaScenario(request);
  await page.goto(`/classifica?categoria=M&stagione=${scenario.stagione}`);
  await waitForLive(page);
  await page
    .getByTestId(`riga-${ME}`)
    .filter({ visible: true })
    .getByRole("link", { name: "Luca Rossi" })
    .click();

  await expect(page).toHaveURL(
    new RegExp(
      `/classifica/giocatore/${ME}\\?categoria=M&stagione=${scenario.stagione}$`,
    ),
  );
  await expect(page).toHaveTitle("Scheda del giocatore · BLVS");
  await expect(
    page.getByRole("heading", { level: 1, name: "Scheda del giocatore" }),
  ).toBeVisible();
  await expect(page.getByTestId("scheda-nome")).toHaveText("Luca Rossi");
  await expect(page.getByTestId("scheda-riepilogo")).toContainText(
    `Stagione ${scenario.stagione} · Maschile`,
  );
  // Two stages, newest first; the open one is provisional.
  await expect(righeTappe(page)).toHaveCount(2);
  await expect(righeTappe(page).first()).toContainText("Tappa B · Sottomarina");
  await expect(righeTappe(page).first()).toContainText("provvisori");
  await expect(righeTappe(page).first()).toContainText("Finale gold");
});

test("ogni tappa porta alla sua classifica di tappa", async ({
  page,
  request,
}) => {
  const scenario = await creaScenario(request);
  await apriScheda(page, ME, scenario);
  await expect(
    righeTappe(page)
      .first()
      .getByRole("link", { name: /Tappa B/ }),
  ).toHaveAttribute(
    "href",
    `/tappe/${scenario.tappaAperta}/classifica?categoria=M`,
  );
});

test("w-giocatore accessibile (axe) con la tabella delle tappe", async ({
  page,
  request,
}) => {
  const scenario = await creaScenario(request);
  await apriScheda(page, ME, scenario);
  await expectNoA11yViolations(page);
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(page.viewportSize()!.width);
});

test("account cancellato: «Giocatore anonimo» senza dati personali", async ({
  page,
  request,
}) => {
  const scenario = await creaScenario(request);
  await page.goto(`/classifica?categoria=M&stagione=${scenario.stagione}`);
  await waitForLive(page);
  const riga = page.getByTestId(`riga-${ANONIMO}`).filter({ visible: true });
  await expect(riga).toContainText("Giocatore anonimo");
  await riga.getByRole("link", { name: "Giocatore anonimo" }).click();

  await expect(page.getByTestId("scheda-nome")).toHaveText("Giocatore anonimo");
  await expect(page.getByTestId("scheda-anonimo")).toBeVisible();
  await expect(righeTappe(page)).toHaveCount(2);
  await expect(page.locator("body")).not.toContainText("Alessandro");
  // Next keeps the previous page hidden in the DOM: look at the card only.
  await expect(
    page.getByTestId("scheda-giocatore").getByText("TU", { exact: true }),
  ).toHaveCount(0);
  await expectNoA11yViolations(page);
});

test("i punti diventano definitivi alla chiusura del tabellone, senza ricaricare", async ({
  page,
  request,
}) => {
  const scenario = await creaScenario(request);
  await apriScheda(page, ME, scenario);
  await expect(page.getByTestId("scheda-riepilogo")).toContainText(
    "provvisori",
  );

  const res = await request.post("/api/demo/classifica-generale", {
    data: { tappaId: scenario.tappaAperta, azione: "concludi" },
  });
  expect(res.status()).toBe(200);

  await expect(page.getByTestId("scheda-riepilogo")).not.toContainText(
    "provvisori",
    { timeout: 5_000 },
  );
  await expect(
    page.locator("[data-slot=live-announcer]").filter({ visible: true }),
  ).toContainText("Scheda aggiornata");
});

test("un giocatore che non è in classifica: «Pagina non trovata»", async ({
  page,
}) => {
  await page.goto("/classifica/giocatore/nessuno?categoria=M&stagione=2026");
  await expect(
    page.getByRole("heading", { level: 1, name: "Pagina non trovata" }),
  ).toBeVisible();
});
