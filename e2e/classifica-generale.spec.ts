import type { APIRequestContext, Page } from "@playwright/test";
import { expect, expectNoA11yViolations, test } from "./fixtures";

/*
 * w-classifica (BLVS-44) end to end, on the demo data (no Supabase env).
 * Each test creates its own hidden season through the e2e fixture
 * POST /api/demo/classifica-generale (TAPPE_DEMO_SEED=true), so parallel
 * projects never see each other's changes. The fixture's «salva» and
 * «concludi» stand in for the admin save (BLVS-32/41) and «Concludi
 * tabellone» (BLVS-43): both publish the overall standing like they do.
 *
 * Never wait for "networkidle": the SSE stream keeps a request open.
 */

const ME = "demo-u-m-01";

const liveBar = (page: Page) =>
  page.getByRole("region", { name: "Stato degli aggiornamenti" });

async function waitForLive(page: Page) {
  await expect(liveBar(page)).toHaveAttribute("data-status", "live", {
    timeout: 10_000,
  });
}

type Scenario = { stagione: number; categoria: "M"; tappaAperta: string };

async function creaScenario(request: APIRequestContext): Promise<Scenario> {
  const res = await request.post("/api/demo/classifica-generale", {
    data: {},
  });
  expect(res.status()).toBe(201);
  return (await res.json()) as Scenario;
}

async function azione(
  request: APIRequestContext,
  tappaId: string,
  azione: "salva" | "concludi",
) {
  const res = await request.post("/api/demo/classifica-generale", {
    data: { tappaId, azione },
  });
  expect(res.status()).toBe(200);
}

async function apri(page: Page, { stagione }: Scenario) {
  await page.goto(`/classifica?categoria=M&stagione=${stagione}`);
  await expect(page.getByTestId("classifica-generale")).toBeVisible();
  await waitForLive(page);
}

/** The demo player's row, in whichever view (table or cards) is shown. */
const miaRiga = (page: Page) =>
  page.getByTestId(`riga-${ME}`).filter({ visible: true });

/** Records every text the single announcer region takes. */
async function recordAnnouncements(page: Page) {
  await page.evaluate(() => {
    const region = document.querySelector("[data-slot=live-announcer]")!;
    const seen: string[] = [];
    (window as unknown as { __announced: string[] }).__announced = seen;
    new MutationObserver(() => {
      if (region.textContent) seen.push(region.textContent);
    }).observe(region, { childList: true, subtree: true, characterData: true });
  });
  return () =>
    page.evaluate(
      () => (window as unknown as { __announced: string[] }).__announced,
    );
}

test("punti provvisori a testo: alla chiusura del tabellone l'etichetta sparisce entro 5 s, senza ricaricare", async ({
  page,
  request,
}) => {
  const scenario = await creaScenario(request);
  await apri(page, scenario);
  await expect(miaRiga(page)).toContainText("provvisori");
  await expect(page.getByTestId("la-tua-posizione")).toContainText(
    "16 punti provvisori",
  );
  await page.evaluate(() => {
    (window as unknown as { __stessaPagina: boolean }).__stessaPagina = true;
  });

  await azione(request, scenario.tappaAperta, "concludi");

  await expect(
    page.locator("[data-slot=punti-provvisori]").filter({ visible: true }),
  ).toHaveCount(0, { timeout: 5_000 });
  await expect(miaRiga(page)).not.toContainText("provvisori");
  expect(
    await page.evaluate(
      () => (window as unknown as { __stessaPagina?: boolean }).__stessaPagina,
    ),
  ).toBe(true);
});

test("un salvataggio admin che rende definitiva una posizione aggiorna la classifica entro 5 s: nuovo orario, un solo annuncio, focus fermo", async ({
  page,
  request,
}) => {
  const scenario = await creaScenario(request);
  await apri(page, scenario);
  const orario = liveBar(page).locator("time");
  const prima = await orario.getAttribute("datetime");

  const ricerca = page.getByRole("searchbox", { name: "Cerca per nome" });
  await ricerca.focus();
  const annunci = await recordAnnouncements(page);

  await azione(request, scenario.tappaAperta, "salva");

  // The demo player loses the last match of the gold final: 16 → 8.
  await expect(page.getByTestId("la-tua-posizione")).toContainText(
    "8 punti provvisori",
    { timeout: 5_000 },
  );
  await expect(orario).not.toHaveAttribute("datetime", prima ?? "", {
    timeout: 5_000,
  });
  await expect(ricerca).toBeFocused();

  // Give a second announcement time to (not) appear.
  await page.waitForTimeout(2_000);
  const detti = await annunci();
  expect(detti).toHaveLength(1);
  expect(detti[0]).toContain("Classifica generale maschile aggiornata");
  expect(detti[0]).toContain("la tua posizione");
  await expect(page.locator("#contenuto [aria-live]")).toHaveCount(1);
});

test("con prefers-reduced-motion nessun lampeggio né riordino animato", async ({
  page,
  request,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  const scenario = await creaScenario(request);
  await apri(page, scenario);

  await azione(request, scenario.tappaAperta, "salva");
  await expect(page.getByTestId("la-tua-posizione")).toContainText("8 punti", {
    timeout: 5_000,
  });
  const animazioni = await page
    .getByTestId("classifica-generale")
    .evaluate((root) => root.getAnimations({ subtree: true }).length);
  expect(animazioni).toBe(0);
});

test("senza movimento ridotto la riga cambiata si evidenzia", async ({
  page,
  request,
}) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  const scenario = await creaScenario(request);
  await apri(page, scenario);

  await azione(request, scenario.tappaAperta, "salva");
  await expect
    .poll(
      () =>
        page
          .getByTestId("classifica-generale")
          .evaluate((root) => root.getAnimations({ subtree: true }).length),
      { timeout: 5_000 },
    )
    .toBeGreaterThan(0);
});

test("ricerca per nome: filtra le righe e dice quante ne trova", async ({
  page,
  request,
}) => {
  const scenario = await creaScenario(request);
  await apri(page, scenario);
  await page.getByRole("searchbox", { name: "Cerca per nome" }).fill("rossi");
  await expect(page.getByRole("status")).toHaveText("1 giocatore trovato.");
  await expect(
    page.locator("[data-testid^=riga-]").filter({ visible: true }),
  ).toHaveCount(1);
  await expect(miaRiga(page)).toContainText("TU");
});

test("w-classifica accessibile (axe), tabella o schede con posizione, nome e punti", async ({
  page,
}) => {
  await page.goto("/classifica");
  await waitForLive(page);
  await expect(page).toHaveTitle("Classifica · BLVS");
  await expectNoA11yViolations(page);

  const riga = miaRiga(page);
  await expect(riga).toContainText("Luca Rossi");
  if ((page.viewportSize()?.width ?? 0) < 768) {
    // 390 px: cards with the position badge, the name and the points.
    await expect(riga).toHaveCount(1);
    await expect(riga.locator("dt", { hasText: "Punti" })).toBeVisible();
    await expect(riga.locator("p").first()).toContainText(/Posizione\s*\d+/);
  } else {
    await expect(page.getByRole("table")).toBeVisible();
    await expect(
      page.getByRole("rowheader", { name: /Luca Rossi/ }),
    ).toBeVisible();
    await expect(
      page.getByRole("columnheader", { name: "Punti" }),
    ).toBeVisible();
  }
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(page.viewportSize()!.width);
});

test("categoria e stagione: link e filtro portano alla classifica scelta", async ({
  page,
}) => {
  await page.goto("/classifica");
  await waitForLive(page);
  await page.getByRole("link", { name: "Femminile" }).click();
  await expect(page).toHaveURL(/categoria=F/);
  await expect(page.getByRole("link", { name: "Femminile" })).toHaveAttribute(
    "aria-current",
    "page",
  );
  await expect(page.getByTestId("la-tua-posizione")).toContainText(
    "Non sei ancora in questa classifica",
  );

  await page.getByRole("combobox", { name: "Stagione" }).selectOption("2025");
  await page.getByRole("button", { name: "Mostra" }).click();
  await expect(page).toHaveURL(/stagione=2025/);
  await expect(
    page.getByText(/Classifica generale femminile · Stagione 2025/).filter({
      visible: true,
    }),
  ).toHaveCount(1);
});
