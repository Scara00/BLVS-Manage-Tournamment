import type { APIRequestContext, Browser, Page } from "@playwright/test";
import { expect, expectNoA11yViolations, test } from "./fixtures";
import { waitForAnimations } from "./storybook-helpers";

/*
 * w-classifica-tappa (BLVS-49) end to end, on the in-memory demo (no
 * Supabase env). Each test creates its own stage with both boards in the
 * finals through POST /api/demo/chiusura-tabellone (TAPPE_DEMO_SEED). The
 * demo player is the men's seat 1: 1st of the gold final.
 *
 * The admin saves and closes through the real w-admin-live, in a second
 * browser context that shares the demo store and the live bus.
 *
 * Never wait for "networkidle": the SSE stream keeps a request open.
 */

type Scenario = "finali_concluse" | "partita_aperta";

async function creaTappa(request: APIRequestContext, scenario: Scenario) {
  const res = await request.post("/api/demo/chiusura-tabellone", {
    data: { scenario },
  });
  expect(res.status()).toBe(201);
  return ((await res.json()) as { id: string }).id;
}

const liveBar = (page: Page) =>
  page.getByRole("region", { name: "Stato degli aggiornamenti" });

async function waitForLive(page: Page) {
  await expect(liveBar(page)).toHaveAttribute("data-status", "live", {
    timeout: 10_000,
  });
}

async function apri(page: Page, id: string) {
  await page.goto(`/tappe/${id}/classifica`);
  await expect(page.getByTestId("classifica-tappa")).toBeVisible();
  await waitForLive(page);
}

/** Points of the visible rows of one final, top to bottom. */
function puntiDi(page: Page, fase: "gold" | "silver") {
  return page
    .locator(`[data-fase=${fase}]`)
    .filter({ visible: true })
    .evaluateAll((righe) => righe.map((r) => r.getAttribute("data-punti")));
}

/** A row in whichever view (table or cards) is shown. */
const riga = (page: Page, id: string) =>
  page.getByTestId(`riga-${id}`).filter({ visible: true });

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

/** A second (admin) browser with the same viewport, sharing the demo. */
async function admin(browser: Browser, page: Page) {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    baseURL: new URL(page.url()).origin,
  });
  const adminPage = await context.newPage();
  return { adminPage, close: () => context.close() };
}

async function apriAdminLive(adminPage: Page, id: string) {
  await adminPage.goto(`/admin/tappe/${id}/live/m`);
  await expect(adminPage.getByTestId("admin-live")).toBeVisible();
}

test("da w-tappa e da w-live si arriva alla classifica di tappa", async ({
  page,
  request,
}) => {
  await page.goto("/tappe/jesolo");
  const tabellone = page.locator("[data-categoria=M]");
  await tabellone
    .getByRole("link", { name: "Classifica di tappa · Maschile" })
    .click();
  await expect(page).toHaveURL(/\/tappe\/jesolo\/classifica\?categoria=M$/);
  await expect(page.getByTestId("classifica-tappa")).toHaveAttribute(
    "data-stato",
    "in_attesa",
  );
  await expect(page).toHaveTitle("Classifica di tappa · BLVS");

  const id = await creaTappa(request, "finali_concluse");
  await page.goto(`/tappe/${id}/live`);
  await page.getByRole("link", { name: "Classifica di tappa" }).click();
  await expect(page).toHaveURL(new RegExp(`/tappe/${id}/classifica$`));
  await expect(page.getByTestId("classifica-tappa")).toBeVisible();
});

test("punti per posizione su una tappa di prova: gold 12, 8, 4, 2 e silver 8, 6, 2, 1", async ({
  page,
  request,
}) => {
  const id = await creaTappa(request, "finali_concluse");
  await apri(page, id);
  expect(await puntiDi(page, "gold")).toEqual(["12", "8", "4", "2"]);
  expect(await puntiDi(page, "silver")).toEqual(["8", "6", "2", "1"]);
  await expect(
    page.locator("[data-slot=separatore-finali]").filter({ visible: true }),
  ).toHaveCount(1);
  await expect(
    page.getByText(/^Finale gold · punti/).filter({ visible: true }),
  ).toHaveCount(1);
  await expect(
    page.getByText(/^Finale silver · punti/).filter({ visible: true }),
  ).toHaveCount(1);

  // «La tua tappa»: the demo player is 1st in gold, points still provisional.
  const mia = page.getByTestId("la-tua-tappa");
  await expect(mia).toContainText("1ª");
  await expect(mia).toContainText("12 punti provvisori");

  // Category switch: the women's board, no «La tua tappa».
  await page.getByRole("link", { name: "Femminile" }).click();
  await expect(page).toHaveURL(/categoria=F$/);
  await expect(page.getByTestId("la-tua-tappa")).toHaveCount(0);
  await waitForLive(page);
  expect(await puntiDi(page, "gold")).toEqual(["12", "8", "4", "2"]);
});

test("alla chiusura del tabellone l'etichetta «provvisori» sparisce entro 5 s, senza ricaricare", async ({
  page,
  request,
  browser,
}) => {
  test.setTimeout(60_000);
  const id = await creaTappa(request, "finali_concluse");
  await apri(page, id);
  await expect(riga(page, `${id}-M-i1`)).toContainText("provvisori");
  await page.evaluate(() => {
    (window as unknown as { __stessaPagina: boolean }).__stessaPagina = true;
  });

  const { adminPage, close } = await admin(browser, page);
  await apriAdminLive(adminPage, id);
  const trigger = adminPage.getByRole("button", { name: "Concludi tabellone" });
  await trigger.click();
  await adminPage
    .getByRole("alertdialog", { name: /Concludere il tabellone/ })
    .getByRole("button", { name: "Sì, concludi il tabellone" })
    .click();
  await expect(adminPage.getByTestId("concludi-tabellone-esito")).toContainText(
    "concluso",
  );

  await expect(
    page.locator("[data-slot=punti-provvisori]").filter({ visible: true }),
  ).toHaveCount(0, { timeout: 5_000 });
  await expect(page.getByTestId("classifica-tappa-stato")).toHaveText(
    "Tabellone chiuso: i punti sono definitivi.",
  );
  await expect(page.getByTestId("la-tua-tappa")).toContainText(
    "12 punti: punti definitivi.",
  );
  expect(
    await page.evaluate(
      () => (window as unknown as { __stessaPagina?: boolean }).__stessaPagina,
    ),
  ).toBe(true);
  await close();
});

test("un salvataggio admin che rende definitive le posizioni aggiorna la classifica entro 5 s: nuovo orario, un solo annuncio, focus fermo", async ({
  page,
  request,
  browser,
}) => {
  test.setTimeout(60_000);
  const id = await creaTappa(request, "partita_aperta");
  await apri(page, id);
  const silver = riga(page, `${id}-M-i5`);
  await expect(silver).toContainText("non ancora definitiva");
  const orario = liveBar(page).locator("time");
  const prima = await orario.getAttribute("datetime");

  const femminile = page.getByRole("link", { name: "Femminile" });
  await femminile.focus();
  const annunci = await recordAnnouncements(page);

  // The admin enters the last match of the men's silver final.
  const { adminPage, close } = await admin(browser, page);
  await apriAdminLive(adminPage, id);
  await adminPage
    .getByRole("button", {
      name: "Inserisci punteggio: Finale silver · turno 3",
    })
    .first()
    .click();
  const dialog = adminPage.getByRole("dialog");
  await expect(dialog.locator("*:focus")).toHaveCount(1);
  const set1 = dialog.getByRole("group", { name: "Set 1" });
  await set1.getByRole("textbox").nth(0).fill("21");
  await set1.getByRole("textbox").nth(1).fill("14");
  await dialog.getByRole("button", { name: "Salva e concludi" }).click();
  await expect(dialog).toBeHidden();

  await expect(silver).not.toContainText("non ancora definitiva", {
    timeout: 5_000,
  });
  await expect(orario).not.toHaveAttribute("datetime", prima ?? "", {
    timeout: 5_000,
  });
  await expect(femminile).toBeFocused();

  // Give a second announcement time to (not) appear.
  await page.waitForTimeout(2_000);
  const detti = await annunci();
  expect(detti).toHaveLength(1);
  expect(detti[0]).toContain("Classifica di tappa maschile aggiornata");
  expect(detti[0]).toContain("posizioni definitive");
  expect(detti[0]).toContain("la tua posizione: 1ª");
  await expect(page.locator("#contenuto [aria-live]")).toHaveCount(1);
  await close();
});

test("con prefers-reduced-motion niente palette né animazioni", async ({
  page,
  request,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  const id = await creaTappa(request, "finali_concluse");
  await apri(page, id);
  const root = page.getByTestId("classifica-tappa");
  await expect(root.locator("[data-slot=flip-digits]")).toHaveCount(0);
  await expect(
    root.locator("[data-slot=punti-cifre]").filter({ visible: true }).first(),
  ).toBeVisible();
  expect(
    await root.evaluate((el) => el.getAnimations({ subtree: true }).length),
  ).toBe(0);
});

test("w-classifica-tappa accessibile (axe): tabella con th scope o schede a 390 px", async ({
  page,
  request,
}) => {
  const id = await creaTappa(request, "partita_aperta");
  await apri(page, id);
  await waitForAnimations(page);
  await expectNoA11yViolations(page);

  if ((page.viewportSize()?.width ?? 0) < 768) {
    // 390 px: cards with the position badge, the name and the points.
    await expect(page.locator("table").filter({ visible: true })).toHaveCount(
      0,
    );
    const mia = riga(page, `${id}-M-i1`);
    await expect(mia.locator("dt", { hasText: "Punti" })).toBeVisible();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(390);
  } else {
    const tabelle = page.locator("table").filter({ visible: true });
    await expect(tabelle).toHaveCount(2);
    await expect(tabelle.first().locator("th[scope=col]")).toHaveText([
      "Posizione",
      "Giocatore",
      "Punti",
    ]);
    await expect(tabelle.first().locator("th[scope=row]")).toHaveCount(4);
  }
});
