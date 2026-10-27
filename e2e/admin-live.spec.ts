import type { APIRequestContext, Page } from "@playwright/test";
import { expect, expectNoA11yViolations, test } from "./fixtures";
import { waitForAnimations } from "./storybook-helpers";

/**
 * w-admin-live on the in-memory demo matches (no Supabase in e2e). Each
 * test creates its own stage through the demo-only POST /api/demo/avvio-fase
 * (`avviata: true` starts the M board), because the server and the live bus
 * are shared by parallel projects and reused across runs.
 */
async function creaTappa(request: APIRequestContext, avviata: boolean) {
  const response = await request.post("/api/demo/avvio-fase", {
    data: { scenario: "pronta", avviata },
  });
  expect(response.status()).toBe(201);
  return ((await response.json()) as { id: string }).id;
}

/** SSE keeps a request open: wait for the live bar, never networkidle. */
async function apriLive(page: Page, id: string) {
  await page.goto(`/admin/tappe/${id}/live/m`);
  await expect(page.getByTestId("admin-live")).toBeVisible();
  await expect(
    page.getByRole("region", { name: "Stato degli aggiornamenti" }),
  ).toHaveAttribute("data-status", "live");
}

function partita(page: Page, sezione: string, id: string) {
  return page.getByTestId(sezione).locator(`[data-partita="${id}"]`);
}

/** Focused element must not sit under the sticky topbar. */
async function expectFocusClearOfTopbar(page: Page) {
  const { top, barBottom, sticky } = await page.evaluate(() => {
    const el = document.activeElement as HTMLElement;
    const bar = document.querySelector("header")!;
    const inBar = bar.contains(el);
    return {
      top: inBar ? Infinity : el.getBoundingClientRect().top,
      barBottom: bar.getBoundingClientRect().bottom,
      sticky: getComputedStyle(bar).position === "sticky",
    };
  });
  if (sticky) expect(top).toBeGreaterThanOrEqual(barBottom - 1);
}

test("dopo «Avvia le N partite» si arriva alla gestione live", async ({
  page,
  request,
}) => {
  const id = await creaTappa(request, false);
  await page.goto(`/admin/tappe/${id}/avvio/m`);
  await expect(page.getByTestId("avvio-fase")).toBeVisible();
  await page.waitForLoadState("networkidle");

  await page.getByRole("button", { name: "Avvia le 6 partite" }).click();
  const dialog = page.getByRole("alertdialog");
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Avvia" }).click();

  await expect(page).toHaveURL(new RegExp(`/admin/tappe/${id}/live/m$`));
  await expect(page.getByTestId("avanzamento")).toHaveText(
    "0 di 6 partite concluse",
  );
  const tutte = page.getByTestId("tutte-le-partite");
  await expect(tutte.getByTestId("partita")).toHaveCount(6);
  await expect(tutte.getByText("Da giocare")).toHaveCount(6);
  await expect(page).toHaveTitle(/Gestione live/);
  await expect(
    page.getByRole("region", { name: "Stato degli aggiornamenti" }),
  ).toHaveAttribute("data-status", "live");
  await waitForAnimations(page);
  await expectNoA11yViolations(page);
});

test("quello che fa un admin compare agli altri in tempo reale", async ({
  page,
  browser,
  request,
}) => {
  const id = await creaTappa(request, true);
  const altro = await browser.newContext({
    viewport: page.viewportSize() ?? undefined,
  });
  const secondo = await altro.newPage();
  try {
    await apriLive(page, id);
    await apriLive(secondo, id);
    const primaPartita = `${id}-M-g1-t1`;

    // Admin 1 starts the match…
    await partita(page, "tutte-le-partite", primaPartita)
      .getByRole("button", { name: /^Inizia/ })
      .click();
    await expect(page.getByTestId("admin-live-esito")).toBeFocused();
    await expect(page.getByTestId("admin-live-esito")).toHaveText(
      "Girone A · turno 1: partita in corso.",
    );

    // …admin 2 sees it in progress, with its result due.
    const scheda = partita(secondo, "partite-in-corso", primaPartita);
    await expect(scheda).toBeVisible({ timeout: 5_000 });
    await expect(scheda).toContainText("In corso");
    await expect(scheda).toContainText("Punteggio da inserire");

    // Admin 1 enters the score and concludes…
    await partita(page, "partite-in-corso", primaPartita)
      .getByRole("button", { name: /^Inserisci punteggio/ })
      .click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.locator("*:focus")).toHaveCount(1);
    const set1 = dialog.getByRole("group", { name: "Set 1" });
    const set2 = dialog.getByRole("group", { name: "Set 2" });
    await set1.getByRole("textbox").nth(0).fill("21");
    await set1.getByRole("textbox").nth(1).fill("18");
    await set2.getByRole("textbox").nth(0).fill("21");
    await set2.getByRole("textbox").nth(1).fill("15");
    await waitForAnimations(page);
    await expectNoA11yViolations(page);
    await dialog.getByRole("button", { name: "Salva e concludi" }).click();
    await expect(dialog).toBeHidden();

    // …and admin 2's progress moves on its own.
    await expect(secondo.getByTestId("avanzamento")).toHaveText(
      "1 di 6 partite concluse",
      { timeout: 5_000 },
    );
    const conclusa = partita(secondo, "tutte-le-partite", primaPartita);
    await expect(conclusa).toContainText("Conclusa");
    await expect(conclusa).toContainText("21-18 · 21-15");
    await expect(conclusa).not.toContainText("Punteggio da inserire");
  } finally {
    await altro.close();
  }
});

test("azioni da almeno 48 px e fuoco mai sotto la topbar", async ({
  page,
  request,
}) => {
  const id = await creaTappa(request, true);
  await apriLive(page, id);
  await expect(page).toHaveTitle(/Gestione live/);
  await expectNoA11yViolations(page);

  const azioni = page
    .getByTestId("admin-live")
    .locator("button:visible, a:visible");
  const n = await azioni.count();
  expect(n).toBeGreaterThan(6);
  for (let i = 0; i < n; i++) {
    const box = (await azioni.nth(i).boundingBox())!;
    expect(box.height, await azioni.nth(i).innerText()).toBeGreaterThanOrEqual(
      48,
    );
    expect(box.width).toBeGreaterThanOrEqual(48);
  }

  // Walk the page by keyboard: every stop stays clear of the sticky bar.
  await page.getByTestId("avanzamento").click();
  for (let i = 0; i < 12; i++) {
    await page.keyboard.press("Tab");
    await expectFocusClearOfTopbar(page);
  }
});

test("tabellone non avviato: rimanda all'avvio", async ({ page, request }) => {
  const id = await creaTappa(request, false);
  await page.goto(`/admin/tappe/${id}/live/f`);
  await expect(page.getByTestId("admin-live-vuota")).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Vai all'avvio della fase" }),
  ).toHaveAttribute("href", `/admin/tappe/${id}/avvio/f`);
  await expect(
    page.getByRole("region", { name: "Stato degli aggiornamenti" }),
  ).toHaveAttribute("data-status", "live");
  await expectNoA11yViolations(page);
});
