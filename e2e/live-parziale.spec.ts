import type { APIRequestContext, Browser, Page } from "@playwright/test";
import { expect, expectNoA11yViolations, test } from "./fixtures";
import { waitForAnimations } from "./storybook-helpers";

/*
 * BLVS-37: the admin sends the partial of a match in progress from
 * w-admin-punteggio; the players see it on w-live within 5 s, without
 * reloading, outside the standings. One fresh demo stage per test whose
 * first match (men's Girone A, round 1, with the demo player «Luca Rossi»)
 * is already started. Never wait for "networkidle" on w-live (SSE).
 */

const liveBar = (page: Page) =>
  page.getByRole("region", { name: "Stato degli aggiornamenti" });

async function waitForLive(page: Page) {
  await expect(liveBar(page)).toHaveAttribute("data-status", "live", {
    timeout: 10_000,
  });
}

async function creaPartitaInCorso(request: APIRequestContext) {
  const response = await request.post("/api/demo/inserimento-punteggio", {
    data: { inCorso: true },
  });
  expect(response.status()).toBe(201);
  return (await response.json()) as { id: string; partitaId: string };
}

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

/** w-admin-punteggio of the match, in its own browser context. */
async function apriAdmin(
  browser: Browser,
  baseURL: string,
  id: string,
  partitaId: string,
) {
  const context = await browser.newContext({ baseURL });
  const admin = await context.newPage();
  await admin.goto(`/admin/tappe/${id}/punteggi/${partitaId}`);
  await expect(admin.getByTestId("parziale-form")).toBeVisible();
  await admin.waitForLoadState("networkidle");
  return { context, admin };
}

async function inviaParziale(admin: Page, a: string, b: string) {
  const form = admin.getByTestId("parziale-form");
  const campi = form.getByRole("textbox");
  await campi.nth(0).fill(a);
  await campi.nth(1).fill(b);
  await form.getByRole("button", { name: "Invia parziale" }).click();
  await expect(admin.getByTestId("esito-parziale")).toContainText(
    `Parziale inviato ai giocatori`,
  );
  await expect(admin.getByTestId("esito-parziale")).toContainText(
    `${a} – ${b}`,
  );
}

const card = (page: Page, partitaId: string) =>
  page
    .getByTestId("live-mie-partite")
    .locator(`li[data-live-key="${partitaId}"]`);

test("il parziale arriva su w-live entro 5 s, fuori classifica, focus fermo, un annuncio ogni 30 s", async ({
  page,
  browser,
  request,
}, testInfo) => {
  test.setTimeout(90_000);
  const { id, partitaId } = await creaPartitaInCorso(request);
  await page.goto(`/tappe/${id}/live`);
  await waitForLive(page);
  const announced = await recordAnnouncements(page);
  await page.evaluate(() => {
    (window as unknown as { __stessaPagina: boolean }).__stessaPagina = true;
  });
  const girone = page.getByTestId("live-mio-girone");
  const classificaPrima = await girone.innerText();
  const link = page.getByRole("link", { name: "Informativa privacy" });
  await link.focus();

  const { context, admin } = await apriAdmin(
    browser,
    testInfo.project.use.baseURL!,
    id,
    partitaId,
  );
  await expect(admin.getByTestId("parziale-form")).toContainText(
    "Il parziale non entra in classifica.",
  );
  await expectNoA11yViolations(admin);

  await inviaParziale(admin, "14", "11");
  const inviato = Date.now();
  const parziale = card(page, partitaId).getByTestId("punteggio-parziale");
  await expect(parziale).toContainText(/Parziale: .* 14, .* 11/, {
    timeout: 5_000,
  });
  expect(Date.now() - inviato).toBeLessThan(5_000);
  await expect(card(page, partitaId)).toContainText("Parziale · in corso");
  await expect(card(page, partitaId)).toContainText("Non entra in classifica");

  // No reload, the focus did not move, still one polite region.
  expect(
    await page.evaluate(
      () => (window as unknown as { __stessaPagina?: boolean }).__stessaPagina,
    ),
  ).toBe(true);
  await expect(link).toBeFocused();
  await expect(page.locator("#contenuto [aria-live]")).toHaveCount(1);
  await expect
    .poll(announced)
    .toContainEqual(expect.stringContaining("La tua partita, parziale:"));

  // A second partial within 30 s is shown but not read aloud.
  await inviaParziale(admin, "15", "11");
  await expect(parziale).toContainText(/ 15, .* 11/, { timeout: 5_000 });
  await page.waitForTimeout(2_000);
  const letti = (await announced()).filter((t) => t.includes("parziale"));
  expect(letti).toHaveLength(1);
  await expect(link).toBeFocused();

  // The standing is untouched: a partial is not a result.
  expect(await girone.innerText()).toBe(classificaPrima);

  // The admin list shows the partial next to the match.
  await admin.goto(`/admin/tappe/${id}/punteggi`);
  await expect(
    admin
      .locator(`li[data-partita="${partitaId}"]`)
      .getByTestId("parziale-elenco"),
  ).toContainText("15–11");
  await context.close();

  await waitForAnimations(page);
  await expectNoA11yViolations(page);
});

test("con riduzione del movimento le cifre del parziale cambiano senza paletta", async ({
  page,
  browser,
  request,
}, testInfo) => {
  test.setTimeout(60_000);
  await page.emulateMedia({ reducedMotion: "reduce" });
  const { id, partitaId } = await creaPartitaInCorso(request);
  const { context, admin } = await apriAdmin(
    browser,
    testInfo.project.use.baseURL!,
    id,
    partitaId,
  );
  await inviaParziale(admin, "3", "2");
  await page.goto(`/tappe/${id}/live`);
  await waitForLive(page);
  const parziale = card(page, partitaId).getByTestId("punteggio-parziale");
  await expect(parziale).toContainText(/ 3, .* 2/);

  await inviaParziale(admin, "4", "2");
  await expect(parziale).toContainText(/ 4, .* 2/, { timeout: 5_000 });
  expect(await parziale.locator('[class*="animate-flip"]').count()).toBe(0);
  const running = await parziale.evaluate(
    (root) => root.getAnimations({ subtree: true }).length,
  );
  expect(running).toBe(0);
  await context.close();
});
