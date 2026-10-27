import type { APIRequestContext, Browser, Page } from "@playwright/test";
import { expect, expectNoA11yViolations, test } from "./fixtures";
import { waitForAnimations } from "./storybook-helpers";

/**
 * w-admin-conflitto (BLVS-34): two admins, two browser contexts, the same
 * demo match. Each test creates its own stage in progress through the
 * demo-only POST /api/demo/inserimento-punteggio.
 */
async function creaTappa(request: APIRequestContext) {
  const response = await request.post("/api/demo/inserimento-punteggio");
  expect(response.status()).toBe(201);
  return ((await response.json()) as { id: string }).id;
}

const campo = (page: Page, n: 0 | 1) =>
  page.getByRole("textbox").filter({ visible: true }).nth(n);

/** Opens the first match of the stage, as the score entry page. */
async function apriPartita(page: Page, id: string) {
  await page.goto(`/admin/tappe/${id}/punteggi`);
  await expect(page.getByTestId("elenco-punteggi")).toBeVisible();
  const link = page
    .getByRole("link", { name: /^Inserisci il punteggio:/ })
    .first();
  const href = await link.getAttribute("href");
  await page.goto(href!);
  await expect(page.getByTestId("inserimento-punteggio")).toBeVisible();
  // Client buttons hydrate after the streamed content.
  await page.waitForLoadState("networkidle");
  return href!;
}

async function salva(page: Page, a: string, b: string) {
  await campo(page, 0).fill(a);
  await campo(page, 1).fill(b);
  await page.getByRole("button", { name: "Vai al riepilogo" }).click();
  await page.getByRole("button", { name: "Conferma e salva" }).click();
}

/** Two admins on the same match: Giulia saves 21–18 first. */
async function dueAdmin(
  browser: Browser,
  request: APIRequestContext,
  page: Page,
) {
  const id = await creaTappa(request);
  const href = await apriPartita(page, id);
  const altro = await browser.newContext({
    viewport: page.viewportSize(),
    baseURL: new URL(page.url()).origin,
  });
  const giulia = await altro.newPage();
  await giulia.goto(href);
  await expect(giulia.getByTestId("inserimento-punteggio")).toBeVisible();
  await giulia.waitForLoadState("networkidle");
  await salva(giulia, "21", "18");
  await expect(giulia.getByTestId("esito-punteggio")).toContainText(
    "Punteggio salvato",
  );
  return { href, giulia, altro };
}

test("il conflitto mostra salvato e tuo, axe, punteggio su una riga", async ({
  page,
  browser,
  request,
}) => {
  const { altro } = await dueAdmin(browser, request, page);
  await salva(page, "21", "19");

  const dialog = page.getByRole("alertdialog", {
    name: "Il punteggio è cambiato",
  });
  await expect(dialog).toBeVisible();
  await waitForAnimations(page);
  await expect(dialog.locator("*:focus")).toHaveCount(1);
  await expect(
    dialog.getByRole("button", { name: "Tieni il salvato" }),
  ).toBeFocused();

  const salvato = dialog.getByRole("group", { name: /Salvato/ });
  const mio = dialog.getByRole("group", { name: "Il tuo" });
  await expect(salvato).toContainText("Ufficiale");
  await expect(salvato).toContainText("21-18");
  await expect(mio).toContainText("21-19");
  // Marked by more than colour: underlined digits and a sentence.
  await expect(dialog.locator("[data-diverso]")).toHaveText(["18", "19"]);
  await expect(dialog.getByTestId("conflitto-differenze")).toContainText(
    "salvato 18, tuo 19",
  );

  // The score never wraps, at 390 px too.
  for (const riga of [salvato, mio]) {
    const punteggio = riga.locator("[data-slot=punteggio]");
    const { height, fontSize } = await punteggio.evaluate((el) => ({
      height: el.getBoundingClientRect().height,
      fontSize: parseFloat(getComputedStyle(el).fontSize),
    }));
    expect(height).toBeLessThan(fontSize * 2);
  }

  await expectNoA11yViolations(page);
  await altro.close();
});

test("da tastiera: «Sovrascrivi» con conferma, l'altro admin vede il nuovo valore", async ({
  page,
  browser,
  request,
}) => {
  const { href, giulia, altro } = await dueAdmin(browser, request, page);
  await salva(page, "21", "19");

  const dialog = page.getByRole("alertdialog", {
    name: "Il punteggio è cambiato",
  });
  await expect(dialog).toBeVisible();
  await expect(dialog.locator("*:focus")).toHaveCount(1);
  const sovrascrivi = dialog.getByRole("button", { name: "Sovrascrivi" });
  for (let i = 0; i < 10; i++) {
    if (await sovrascrivi.evaluate((el) => el === document.activeElement)) {
      break;
    }
    await page.keyboard.press("Tab");
  }
  await expect(sovrascrivi).toBeFocused();
  await page.keyboard.press("Enter");

  const conferma = page.getByRole("alertdialog", {
    name: "Sovrascrivere il punteggio ufficiale?",
  });
  await expect(conferma).toContainText(
    "Il punteggio salvato 21-18 viene sostituito dal tuo 21-19",
  );
  await expect(conferma.getByRole("button", { name: "Annulla" })).toBeFocused();
  await waitForAnimations(page);
  await expectNoA11yViolations(page);

  await page.keyboard.press("Tab");
  await expect(
    conferma.getByRole("button", { name: "Sì, sovrascrivi" }),
  ).toBeFocused();
  await page.keyboard.press("Enter");

  await expect(conferma).toBeHidden();
  await expect(page.getByTestId("esito-punteggio")).toContainText(
    "Punteggio corretto",
  );
  await expect(page.getByTestId("esito-punteggio")).toBeFocused();

  await giulia.goto(href);
  await expect(giulia.getByTestId("punteggio-attuale")).toContainText("21–19");
  await altro.close();
});

test("«Tieni il salvato» non sovrascrive nulla e riprende il valore ufficiale", async ({
  page,
  browser,
  request,
}) => {
  const { href, altro } = await dueAdmin(browser, request, page);
  await salva(page, "21", "19");

  const dialog = page.getByRole("alertdialog", {
    name: "Il punteggio è cambiato",
  });
  await expect(dialog).toBeVisible();
  await expect(dialog.locator("*:focus")).toHaveCount(1);
  await page.keyboard.press("Enter");

  await expect(dialog).toBeHidden();
  await expect(page.getByTestId("esito-punteggio")).toContainText(
    "Hai tenuto il punteggio salvato",
  );
  await expect(page.getByTestId("esito-punteggio")).toBeFocused();
  await expect(campo(page, 0)).toHaveValue("21");
  await expect(campo(page, 1)).toHaveValue("18");

  // The official value is still the first admin's.
  await page.goto(href);
  await expect(page.getByTestId("punteggio-attuale")).toContainText("21–18");
  await altro.close();
});
