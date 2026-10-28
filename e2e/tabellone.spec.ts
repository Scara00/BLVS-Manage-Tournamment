import type {
  APIRequestContext,
  Browser,
  Page,
  TestInfo,
} from "@playwright/test";
import { expect, expectNoA11yViolations, test } from "./fixtures";
import { waitForAnimations } from "./storybook-helpers";

/*
 * w-tabellone (BLVS-48): the phases of a stage's boards, the player's place
 * and every group with its qualifying line. Results are saved for real
 * through the admin score entry (BLVS-32) and boards are closed through
 * w-admin-live (BLVS-43), in a second browser context, on a fresh demo
 * stage per test: the server and its live bus are shared by parallel
 * projects. The demo player is the men's seat 1 («Luca Rossi»).
 *
 * Never wait for "networkidle" on this page: SSE keeps a request open.
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

async function creaTappaFinali(request: APIRequestContext) {
  const response = await request.post("/api/demo/chiusura-tabellone", {
    data: { scenario: "finali_concluse" },
  });
  expect(response.status()).toBe(201);
  return ((await response.json()) as { id: string }).id;
}

function baseURLOf(testInfo: TestInfo) {
  return testInfo.project.use.baseURL!;
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

/** The admin saves 19–21 on the first match of the stage (Girone A). */
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

/** The admin concludes the men's board from w-admin-live. */
async function concludiDaAdmin(browser: Browser, baseURL: string, id: string) {
  const context = await browser.newContext({ baseURL });
  const admin = await context.newPage();
  await admin.goto(`/admin/tappe/${id}/live/m`);
  await expect(liveBar(admin)).toHaveAttribute("data-status", "live");
  await admin.getByRole("button", { name: "Concludi tabellone" }).click();
  const dialog = admin.getByRole("alertdialog", {
    name: /Concludere il tabellone/,
  });
  await dialog
    .getByRole("button", { name: "Sì, concludi il tabellone" })
    .click();
  await expect(admin.getByTestId("concludi-tabellone-esito")).toContainText(
    "concluso: i punti sono definitivi",
  );
  await context.close();
}

const fasi = (page: Page, categoria: "M" | "F") =>
  page
    .getByTestId(`board-${categoria}`)
    .getByRole("list", { name: /^Fasi del tabellone/ });

const gironeA = (page: Page, id: string) =>
  page.locator(`[id="girone-${id}-M-g1"]`);

test("fasi a testo con aria-current, la mia posizione apre il mio girone, axe", async ({
  page,
  request,
}) => {
  const id = await creaTappa(request);
  await page.goto(`/tappe/${id}/tabellone`);
  await waitForLive(page);
  await expect(page).toHaveTitle("Gironi e fasi · BLVS");

  const passiM = fasi(page, "M").getByRole("listitem");
  await expect(passiM).toHaveText([
    /Iscrizioni/,
    /Gironi iniziali/,
    /Gironi gold e silver/,
    /Finali/,
    /Conclusa/,
  ]);
  await expect(fasi(page, "M").locator("[aria-current=step]")).toHaveCount(1);
  await expect(fasi(page, "M").locator("[aria-current=step]")).toContainText(
    "Gironi iniziali",
  );
  // The women's board has not started: «Iscrizioni» is current.
  await expect(fasi(page, "F").locator("[aria-current=step]")).toContainText(
    "Iscrizioni",
  );

  const mia = page.getByRole("region", { name: "La tua posizione" });
  await expect(mia).toContainText("Girone A");
  await mia.getByRole("link", { name: "Apri il tuo girone" }).click();
  await expect(gironeA(page, id)).toBeFocused();
  await expect(page).toHaveURL(new RegExp(`#girone-${id}-M-g1$`));

  // Every group shows its line; mine says where «tu» stand.
  for (const girone of await page.getByTestId("girone-tabellone").all()) {
    await expect(girone.getByTestId("taglio")).toContainText(
      "Linea di taglio dopo il 2° posto",
    );
  }
  await expect(
    gironeA(page, id)
      .getByText("Tu", { exact: true })
      .filter({ visible: true }),
  ).toHaveCount(1);

  await waitForAnimations(page);
  await expectNoA11yViolations(page);
  const overflow = await page.evaluate(
    () =>
      document.documentElement.scrollWidth -
      document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
});

test("dopo un salvataggio admin le righe si aggiornano entro 5 s, senza ricaricare", async ({
  page,
  browser,
  request,
}, testInfo) => {
  test.setTimeout(60_000);
  const id = await creaTappa(request);
  await page.goto(`/tappe/${id}/tabellone`);
  await waitForLive(page);
  const announced = await recordAnnouncements(page);
  await page.evaluate(() => {
    (window as unknown as { __stessaPagina: boolean }).__stessaPagina = true;
  });
  const before = await liveBar(page).locator("time").getAttribute("datetime");
  await expect(gironeA(page, id)).toContainText("Da giocare");

  const link = page.getByRole("link", { name: "Informativa privacy" });
  await link.focus();

  await salvaDaAdmin(browser, baseURLOf(testInfo), id);
  const saved = Date.now();
  // The group now has a result: places and «In corso».
  await expect(gironeA(page, id)).toContainText("In corso", { timeout: 5_000 });
  expect(Date.now() - saved).toBeLessThan(5_000);
  await expect(
    gironeA(page, id).locator("[data-taglio=dopo]").filter({ visible: true }),
  ).toHaveCount(1);

  expect(
    await page.evaluate(
      () => (window as unknown as { __stessaPagina?: boolean }).__stessaPagina,
    ),
  ).toBe(true);
  const after = await liveBar(page).locator("time").getAttribute("datetime");
  expect(Date.parse(after!)).toBeGreaterThan(Date.parse(before!));

  // One polite region, one short sentence for the result; focus stays.
  await expect(page.locator("#contenuto [aria-live]")).toHaveCount(1);
  await expect
    .poll(announced, { timeout: 5_000 })
    .toEqual([expect.stringMatching(/Sei \d+° .*in Girone A$/)]);
  await expect(link).toBeFocused();
});

test("alla chiusura del tabellone la fase diventa «Conclusa»", async ({
  page,
  browser,
  request,
}, testInfo) => {
  test.setTimeout(60_000);
  const id = await creaTappaFinali(request);
  await page.goto(`/tappe/${id}/tabellone`);
  await waitForLive(page);
  await expect(fasi(page, "M").locator("[aria-current=step]")).toContainText(
    "Finali",
  );

  await concludiDaAdmin(browser, baseURLOf(testInfo), id);
  await expect(fasi(page, "M").locator("[aria-current=step]")).toContainText(
    "Conclusa",
    { timeout: 5_000 },
  );
  await expect(page.locator("[data-slot=live-announcer]")).toContainText(
    "Tabellone concluso",
  );
});

test("con prefers-reduced-motion nessuna animazione dopo un aggiornamento", async ({
  page,
  browser,
  request,
}, testInfo) => {
  test.setTimeout(60_000);
  await page.emulateMedia({ reducedMotion: "reduce" });
  const id = await creaTappa(request);
  await page.goto(`/tappe/${id}/tabellone`);
  await waitForLive(page);
  await salvaDaAdmin(browser, baseURLOf(testInfo), id);
  await expect(gironeA(page, id)).toContainText("In corso", { timeout: 5_000 });
  const running = await page.evaluate(
    () =>
      document
        .querySelector("[data-testid=tabellone]")!
        .getAnimations({ subtree: true }).length,
  );
  expect(running).toBe(0);
  await expect(page.locator("[data-slot=tape].animate-tape-snap")).toHaveCount(
    0,
  );
});
