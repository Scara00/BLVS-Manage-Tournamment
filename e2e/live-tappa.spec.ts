import type {
  APIRequestContext,
  Browser,
  Page,
  TestInfo,
} from "@playwright/test";
import { expect, expectNoA11yViolations, test } from "./fixtures";
import { waitForAnimations } from "./storybook-helpers";

/*
 * w-live (BLVS-36): the player's live screen of one stage. Results are
 * saved for real through the admin score entry (BLVS-32) in a second
 * browser context, on a fresh demo stage per test, because the server and
 * its live bus are shared by parallel projects and reused across runs.
 * The demo player is the stage's men's seat 1 («Luca Rossi», Girone A).
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

/**
 * The admin saves 19–21 on the first match of the stage (Girone A, round
 * 1, with the demo player on the losing side) in its own context, so the
 * player's context can go offline on its own. Returns the match id.
 */
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
  const partitaId = admin.url().split("/").pop()!;
  const campi = admin.getByRole("textbox").filter({ visible: true });
  await campi.nth(0).fill("19");
  await campi.nth(1).fill("21");
  await admin.getByRole("button", { name: "Vai al riepilogo" }).click();
  await admin.getByRole("button", { name: "Conferma e salva" }).click();
  await expect(admin.getByTestId("esito-punteggio")).toContainText(
    "Punteggio salvato",
  );
  await context.close();
  return partitaId;
}

const card = (page: Page, partitaId: string) =>
  page
    .getByTestId("live-mie-partite")
    .locator(`li[data-live-key="${partitaId}"]`);

function baseURLOf(testInfo: TestInfo) {
  return testInfo.project.use.baseURL!;
}

test("la mia partita e il mio girone in evidenza, «Tu» a testo, Gold/Silver", async ({
  page,
}) => {
  await page.goto("/tappe/jesolo/live");
  await waitForLive(page);
  await expect(page).toHaveTitle("Live della tappa · BLVS");
  await expect(page.getByTestId("live-tappa-nome")).toHaveText(
    "Tappa 1 · Jesolo",
  );

  const mie = page.getByTestId("live-mie-partite");
  await expect(mie.locator("li")).toHaveCount(3);
  await expect(mie.locator("li").first()).toContainText("Luca Rossi (tu)");

  const girone = page.getByRole("region", {
    name: /^Il tuo girone · Girone A/,
  });
  await expect(
    girone.getByText("Tu", { exact: true }).filter({ visible: true }),
  ).toHaveCount(1);
  await expect(girone.getByText(/Gold/)).toBeVisible();

  const inCampo = page.getByTestId("live-in-campo");
  await expect(inCampo.getByText(/Gold/).first()).toBeVisible();
  await expect(inCampo.getByText(/Silver/).first()).toBeVisible();
  await expect(inCampo).toContainText("★");
  await expect(inCampo).toContainText("◆");
  await expectNoA11yViolations(page);
});

test("in campo: due colonne a 1440, una a 390, niente scorrimento orizzontale", async ({
  page,
}, testInfo) => {
  await page.goto("/tappe/jesolo/live");
  await waitForLive(page);
  const cards = page.getByTestId("live-in-campo").locator("li");
  expect(await cards.count()).toBeGreaterThanOrEqual(2);
  const [a, b] = [
    (await cards.nth(0).boundingBox())!,
    (await cards.nth(1).boundingBox())!,
  ];
  if (testInfo.project.name === "desktop-1440") {
    expect(a.y).toBe(b.y);
  } else {
    expect(b.y).toBeGreaterThan(a.y);
  }
  // Scores never wrap inside a set.
  for (const score of await page
    .locator("[data-slot=live-punteggio] [aria-hidden=true]")
    .all()) {
    const box = await score.boundingBox();
    if (!box) continue;
    const lineHeight = await score.evaluate((el) =>
      parseFloat(getComputedStyle(el).lineHeight),
    );
    expect(box.height).toBeLessThanOrEqual(lineHeight * 1.2);
  }
  const overflow = await page.evaluate(
    () =>
      document.documentElement.scrollWidth -
      document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
});

test("dopo un salvataggio admin il punteggio arriva entro 5 s, senza ricaricare", async ({
  page,
  browser,
  request,
}, testInfo) => {
  test.setTimeout(60_000);
  const id = await creaTappa(request);
  await page.goto(`/tappe/${id}/live`);
  await waitForLive(page);
  const announced = await recordAnnouncements(page);
  await page.evaluate(() => {
    (window as unknown as { __stessaPagina: boolean }).__stessaPagina = true;
  });
  const before = await liveBar(page).locator("time").getAttribute("datetime");

  // Focus stays where the player left it.
  const link = page.getByRole("link", { name: "Informativa privacy" });
  await link.focus();

  const partitaId = await salvaDaAdmin(browser, baseURLOf(testInfo), id);
  const saved = Date.now();
  await expect(card(page, partitaId)).toContainText("19–21", {
    timeout: 5_000,
  });
  expect(Date.now() - saved).toBeLessThan(5_000);
  await expect(card(page, partitaId)).toContainText("Finita");

  // No reload: the marker set on this document is still there.
  expect(
    await page.evaluate(
      () => (window as unknown as { __stessaPagina?: boolean }).__stessaPagina,
    ),
  ).toBe(true);

  // The Live bar shows the time of the new save.
  const after = await liveBar(page).locator("time").getAttribute("datetime");
  expect(after).not.toBe(before);
  expect(Date.parse(after!)).toBeGreaterThan(Date.parse(before!));

  // One polite, short message; rows are not read; focus did not move.
  // (Outside the content: the toast viewport and Next's route announcer.)
  await expect(page.locator("#contenuto [aria-live]")).toHaveCount(1);
  await expect(page.locator("#contenuto [aria-live]")).toHaveAttribute(
    "aria-live",
    "polite",
  );
  await expect
    .poll(announced)
    .toContainEqual(expect.stringContaining("La tua partita: 19-21"));
  for (const text of await announced()) {
    expect(text.length).toBeLessThan(120);
    expect(text).not.toMatch(/Rossi|Bianchi|Marino|Greco/);
  }
  await expect(link).toBeFocused();

  // The standing of my group was recomputed from the saved score.
  const girone = page.getByTestId("live-mio-girone");
  await expect(
    girone.locator("[data-mia=true]").filter({ visible: true }),
  ).toContainText("19");
  // Axe after the highlight and the reorder have finished.
  await waitForAnimations(page);
  await expectNoA11yViolations(page);
});

test("con riduzione del movimento nessuna evidenziazione né animazione", async ({
  page,
  browser,
  request,
}, testInfo) => {
  test.setTimeout(60_000);
  await page.emulateMedia({ reducedMotion: "reduce" });
  const id = await creaTappa(request);
  await page.goto(`/tappe/${id}/live`);
  await waitForLive(page);

  // Counts every animation started on the page from now on.
  await page.evaluate(() => {
    const w = window as unknown as { __animazioni: number };
    w.__animazioni = 0;
    const original = Element.prototype.animate;
    Element.prototype.animate = function (...args) {
      w.__animazioni++;
      return original.apply(this, args);
    };
  });

  const partitaId = await salvaDaAdmin(browser, baseURLOf(testInfo), id);
  await expect(card(page, partitaId)).toContainText("19–21", {
    timeout: 5_000,
  });
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

test("senza rete: «Dati non aggiornati dalle HH:MM», poi riallineamento", async ({
  page,
  context,
  browser,
  request,
}, testInfo) => {
  test.setTimeout(60_000);
  const id = await creaTappa(request);
  await page.goto(`/tappe/${id}/live`);
  await waitForLive(page);
  await expectNoA11yViolations(page);

  await context.setOffline(true);
  await expect(liveBar(page)).toHaveAttribute("data-status", "offline");
  await expect(liveBar(page)).toContainText(
    /Dati non aggiornati dalle \d\d:\d\d/,
  );
  await expectNoA11yViolations(page);

  // Saved by the admin while this player is offline.
  const partitaId = await salvaDaAdmin(browser, baseURLOf(testInfo), id);
  await expect(card(page, partitaId)).not.toContainText("19–21");

  await context.setOffline(false);
  await waitForLive(page);
  await expect(card(page, partitaId)).toContainText("19–21");
});

test("una tappa inesistente risponde 404", async ({ page }) => {
  const res = await page.goto("/tappe/non-esiste/live");
  expect(res?.status()).toBe(404);
});
