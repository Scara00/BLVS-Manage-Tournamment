import type { APIRequestContext, Browser, Page } from "@playwright/test";
import { expect, expectNoA11yViolations, test } from "./fixtures";
import { waitForAnimations } from "./storybook-helpers";

/*
 * w-girone (BLVS-47): one group of a stage, live. As in live-tappa.spec,
 * results are saved through the admin score entry (BLVS-32) in a second
 * context, on a fresh demo stage per test. The demo player is the stage's
 * men's seat 1 («Luca Rossi», Girone A), on the losing side of round 1.
 *
 * Never wait for "networkidle" on the live page: SSE keeps a request open.
 */

const liveBar = (page: Page) =>
  page.getByRole("region", { name: "Stato degli aggiornamenti" });

async function waitForLive(page: Page) {
  await expect(liveBar(page)).toHaveAttribute("data-status", "live", {
    timeout: 10_000,
  });
}

async function creaTappa(request: APIRequestContext) {
  const response = await request.post("/api/demo/inserimento-punteggio");
  expect(response.status()).toBe(201);
  return ((await response.json()) as { id: string }).id;
}

/** From w-live, the «Apri il girone» link of the player's group. */
async function apriGirone(page: Page, id: string) {
  await page.goto(`/tappe/${id}/live`);
  await waitForLive(page);
  await page.getByTestId("live-mio-girone-link").click();
  await expect(page).toHaveURL(new RegExp(`/tappe/${id}/gironi/[^/]+$`));
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Girone A");
  await waitForLive(page);
}

/*
 * After a client-side navigation Next keeps the previous page (w-live)
 * hidden in the DOM, display: none, so its announcer is not exposed: only
 * rendered regions count.
 */
const regioniLive = (page: Page) =>
  page.locator("#contenuto [aria-live]").filter({ visible: true });

async function recordAnnouncements(page: Page) {
  await page.evaluate(() => {
    const region = [
      ...document.querySelectorAll("[data-slot=live-announcer]"),
    ].find((el) => el.getClientRects().length > 0)!;
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

/** The admin saves 19–21 on the stage's first match (Girone A, round 1). */
async function salvaDaAdmin(browser: Browser, baseURL: string, id: string) {
  const context = await browser.newContext({ baseURL });
  const admin = await context.newPage();
  await admin.goto(`/admin/tappe/${id}/punteggi`);
  await admin
    .getByRole("link", { name: /^Inserisci il punteggio:/ })
    .first()
    .click();
  await expect(admin.getByTestId("inserimento-punteggio")).toBeVisible();
  await admin.waitForLoadState("networkidle");
  const campi = admin.getByRole("textbox").filter({ visible: true });
  await campi.nth(0).fill("19");
  await campi.nth(1).fill("21");
  await admin.getByRole("button", { name: "Vai al riepilogo" }).click();
  await admin.getByRole("button", { name: "Conferma e salva" }).click();
  await expect(admin.getByTestId("esito-punteggio")).toContainText(
    "Punteggio salvato",
  );
  await context.close();
}

test("da w-live al girone: classifica completa, intestazioni e linea di taglio", async ({
  page,
  request,
}, testInfo) => {
  const id = await creaTappa(request);
  await apriGirone(page, id);
  await expect(page).toHaveTitle("Girone · BLVS");

  const desktop = testInfo.project.name === "desktop-1440";
  if (desktop) {
    const table = page.getByRole("table", { name: "Classifica Girone A" });
    await expect(table).toBeVisible();
    const headers = table.getByRole("columnheader");
    await expect(headers).toHaveCount(7);
    await expect(headers).toHaveText([
      /Pos\..*Posizione/,
      "Giocatore",
      /PG.*Partite giocate/,
      /V.*Vittorie/,
      /PF.*Punti fatti/,
      /PS.*Punti subiti/,
      /Diff.*Differenza punti/,
    ]);
    for (const h of await headers.all()) {
      await expect(h).toHaveAttribute("scope", "col");
    }
    const names = table.getByRole("rowheader");
    await expect(names).toHaveCount(4);
    await expect(names.first()).toHaveAttribute("scope", "row");
  } else {
    // 390 px: cards with position, name, wins and difference only.
    await expect(page.getByRole("table")).toBeHidden();
    const list = page.getByRole("list", { name: "Classifica Girone A" });
    await expect(list).toBeVisible();
    const card = list.locator("li[data-live-key]").first();
    await expect(card).toContainText("Vittorie");
    await expect(card).toContainText("Diff.");
    await expect(card).not.toContainText("Punti fatti");
  }
  const linea = page
    .locator("[data-slot=linea-taglio]")
    .filter({ visible: true });
  await expect(linea).toHaveCount(1);
  await expect(linea).toContainText("★ Gold");
  await expect(linea).toContainText("◆ Silver");

  await expect(
    page.getByRole("link", { name: "Regole dei gironi e degli spareggi" }),
  ).toHaveAttribute("href", "/regole#spareggi-girone");

  const overflow = await page.evaluate(
    () =>
      document.documentElement.scrollWidth -
      document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
  await expectNoA11yViolations(page);
});

test("dopo un salvataggio admin risultato e classifica arrivano entro 5 s, senza ricaricare", async ({
  page,
  browser,
  request,
}, testInfo) => {
  test.setTimeout(60_000);
  const id = await creaTappa(request);
  await apriGirone(page, id);
  const announced = await recordAnnouncements(page);
  await page.evaluate(() => {
    (window as unknown as { __stessaPagina: boolean }).__stessaPagina = true;
  });
  const before = await liveBar(page).locator("time").getAttribute("datetime");
  const link = page.getByRole("link", { name: "Torna al live della tappa" });
  await link.focus();

  await salvaDaAdmin(browser, testInfo.project.use.baseURL!, id);
  const saved = Date.now();
  const turno1 = page
    .getByTestId("girone-partite")
    .locator("li")
    .filter({ hasText: "Turno 1" });
  await expect(turno1).toContainText("19–21", { timeout: 5_000 });
  await expect(turno1).toContainText("Finita");
  // The standing follows: my row now has one match played and 19 scored.
  const mia = page
    .getByTestId("girone-classifica")
    .locator("[data-mia=true]")
    .filter({ visible: true });
  await expect(mia).toContainText(/−2/, { timeout: 5_000 });
  expect(Date.now() - saved).toBeLessThan(5_000);

  expect(
    await page.evaluate(
      () => (window as unknown as { __stessaPagina?: boolean }).__stessaPagina,
    ),
  ).toBe(true);
  const after = await liveBar(page).locator("time").getAttribute("datetime");
  expect(Date.parse(after!)).toBeGreaterThan(Date.parse(before!));

  // ONE polite region, one short message for the result; focus stays.
  await expect(regioniLive(page)).toHaveCount(1);
  await expect(regioniLive(page)).toHaveAttribute("aria-live", "polite");
  await expect
    .poll(announced)
    .toContainEqual(expect.stringContaining("La tua partita: 19-21"));
  // Leave time for a standings event to be (wrongly) read.
  await page.waitForTimeout(1_500);
  const texts = await announced();
  expect(texts).toHaveLength(1);
  expect(texts[0].length).toBeLessThan(120);
  expect(texts[0]).not.toMatch(/Classifica/);
  await expect(link).toBeFocused();

  await waitForAnimations(page);
  await expectNoA11yViolations(page);
});

test("con riduzione del movimento nessuna evidenziazione né riordino animato", async ({
  page,
  browser,
  request,
}, testInfo) => {
  test.setTimeout(60_000);
  await page.emulateMedia({ reducedMotion: "reduce" });
  const id = await creaTappa(request);
  await apriGirone(page, id);
  await page.evaluate(() => {
    const w = window as unknown as { __animazioni: number };
    w.__animazioni = 0;
    const original = Element.prototype.animate;
    Element.prototype.animate = function (...args) {
      w.__animazioni++;
      return original.apply(this, args);
    };
  });

  await salvaDaAdmin(browser, testInfo.project.use.baseURL!, id);
  await expect(
    page.getByTestId("girone-partite").locator("li").first(),
  ).toContainText("19–21", { timeout: 5_000 });
  expect(
    await page.evaluate(
      () => (window as unknown as { __animazioni: number }).__animazioni,
    ),
  ).toBe(0);
  const running = await page
    .locator("#contenuto")
    .evaluate((root) => root.getAnimations({ subtree: true }).length);
  expect(running).toBe(0);
});

test("un girone che non è della tappa: «Pagina non trovata»", async ({
  page,
  request,
}) => {
  const id = await creaTappa(request);
  // The stage exists, so the proxy lets it through; the group is checked
  // inside the streamed page, hence the not-found page with a 200.
  await page.goto(`/tappe/${id}/gironi/non-esiste`);
  await expect(
    page.getByRole("heading", { level: 1, name: "Pagina non trovata" }),
  ).toBeVisible();
});

test("una tappa inesistente risponde 404", async ({ page }) => {
  const res = await page.goto("/tappe/non-esiste/gironi/g1");
  expect(res?.status()).toBe(404);
});

test("regole: i criteri di spareggio all'ancora #spareggi-girone", async ({
  page,
}) => {
  await page.goto("/regole#spareggi-girone");
  const section = page.getByRole("region", {
    name: "Classifica del girone e spareggi",
  });
  await expect(section).toBeVisible();
  await expect(section.getByRole("listitem")).toHaveCount(5);
  await expectNoA11yViolations(page);
});
