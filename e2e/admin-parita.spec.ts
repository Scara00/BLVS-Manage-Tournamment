import type { APIRequestContext, Locator, Page } from "@playwright/test";
import { expect, expectNoA11yViolations, test } from "./fixtures";

/**
 * w-admin-parita (BLVS-38), opened from w-admin-live and w-admin-gironi on
 * the demo stores (no Supabase env). Every test gets its own stage through
 * POST /api/demo/parita: the men's «Girone A» is over with a perfect
 * three-way tie for 2nd place (Marco Bianchi, Paolo Marino, Andrea Greco).
 * The RPC and its registro entry are covered by the PGlite tests.
 */
async function nuovaParita(request: APIRequestContext) {
  const response = await request.post("/api/demo/parita");
  expect(response.status()).toBe(201);
  return (await response.json()) as { id: string; gironeId: string };
}

/** Waits for the dialog's fade-in: axe would read mid-animation colours. */
async function animazioniFinite(page: Page) {
  await page.evaluate(() =>
    Promise.all(
      document
        .getAnimations()
        .filter((a) => a.effect?.getComputedTiming().iterations !== Infinity)
        .map((a) => a.finished.catch(() => undefined)),
    ),
  );
}

/** Presses Tab until `target` has focus. */
async function tabFino(page: Page, target: Locator, max = 200) {
  for (let i = 0; i < max; i += 1) {
    await page.keyboard.press("Tab");
    if (await target.evaluate((node) => node === document.activeElement)) {
      return;
    }
  }
  throw new Error("Elemento mai raggiunto con Tab");
}

/**
 * Nothing in the dialog's content sticks out of the popup, and the page
 * itself has no sideways scroll. (The popup clips its x-axis, so its own
 * scrollWidth also counts the clipped padding under the scrollbar.)
 */
async function nessunoScrollOrizzontale(dialog: Locator, label: string) {
  const fuori = await dialog.evaluate((node) => {
    const destra = node.getBoundingClientRect().right;
    return [...node.querySelectorAll("[data-slot=dialog-body] > * *")]
      .filter((el) => el.getBoundingClientRect().right > destra + 0.5)
      .map((el) => el.textContent?.slice(0, 40));
  });
  expect(fuori, `contenuto fuori dal dialog ${label}`).toEqual([]);
  const pagina = await dialog.page().evaluate(() => ({
    scroll: document.documentElement.scrollWidth,
    client: document.documentElement.clientWidth,
  }));
  expect(pagina.scroll, `scroll orizzontale ${label}`).toBeLessThanOrEqual(
    pagina.client,
  );
}

test("dalla gestione live: dialog accessibile, scambio e conferma da tastiera", async ({
  page,
  request,
}) => {
  const { id } = await nuovaParita(request);
  await page.goto(`/admin/tappe/${id}/live/m`);
  await expect(page).toHaveTitle("Gestione live · Amministrazione · BLVS");

  const segnale = page.getByTestId("parita-girone");
  await expect(segnale).toContainText("Parità da risolvere");
  await expect(segnale).toContainText(
    "Parità dal 2º al 4º posto: Marco Bianchi, Paolo Marino, Andrea Greco.",
  );

  const apri = page.getByRole("button", {
    name: "Risolvi la parità del Girone A",
  });
  await tabFino(page, apri);
  await page.keyboard.press("Enter");
  const dialog = page.getByRole("dialog", { name: /Parità da risolvere/ });
  await expect(dialog).toBeVisible();
  await expect(dialog.locator("*:focus")).toHaveCount(1);
  await animazioniFinite(page);
  await expect(dialog.getByTestId("criterio-pari")).toHaveCount(4);
  await nessunoScrollOrizzontale(dialog, "nel dialog");
  await expectNoA11yViolations(page);

  // «Scambia ↕»: Marco Bianchi and Paolo Marino swap places.
  const scambia = dialog.getByRole("button", {
    name: "Scambia Marco Bianchi e Paolo Marino",
  });
  await tabFino(page, scambia, 40);
  await page.keyboard.press("Enter");
  await expect(dialog.getByTestId("annuncio-scambio")).toHaveText(
    "Ordine: 2º Paolo Marino, 3º Marco Bianchi, 4º Andrea Greco.",
  );

  // The reason: arrow keys pick the preset, then the free text.
  const sorteggio = dialog.getByRole("radio", { name: "Sorteggio" });
  await tabFino(page, sorteggio, 40);
  await page.keyboard.press("Space");
  await expect(sorteggio).toBeChecked();
  await page.keyboard.press("Tab");
  await expect(dialog.getByLabel(/Dettagli/)).toBeFocused();
  await page.keyboard.type("monetina al campo 1");

  await tabFino(
    page,
    dialog.getByRole("button", { name: "Conferma l'ordine" }),
    20,
  );
  await page.keyboard.press("Enter");
  const conferma = page.getByRole("alertdialog", {
    name: "Decidere questo ordine?",
  });
  await expect(conferma).toBeVisible();
  await expect(conferma.locator("*:focus")).toHaveCount(1);
  await expect(conferma).toContainText("La decisione va nel registro");
  await animazioniFinite(page);
  await expectNoA11yViolations(page);

  await tabFino(
    page,
    conferma.getByRole("button", { name: "Sì, decidi l'ordine" }),
    10,
  );
  await page.keyboard.press("Enter");

  const esito = page.getByTestId("parita-esito");
  await expect(esito).toHaveText(
    "Girone A: ordine deciso. 2º Paolo Marino, 3º Marco Bianchi, 4º Andrea Greco.",
  );
  await expect(esito).toBeFocused();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page).toHaveTitle("Gestione live · Amministrazione · BLVS");
  await expect(segnale).not.toContainText("Parità da risolvere");
  await expect(
    page.getByRole("button", { name: "Modifica la decisione del Girone A" }),
  ).toBeVisible();
  await expectNoA11yViolations(page);

  // The decision is in the stage's registro, with the demo author.
  await page.goto(`/admin/tappe/${id}/registro`);
  await expect(
    page.getByText("Parità risolta").filter({ visible: true }).first(),
  ).toBeVisible();
  await expect(page.locator("#contenuto")).toContainText(
    "Sorteggio: monetina al campo 1",
  );
});

test("dall'editor dei gironi: segnale sulla card e motivo obbligatorio", async ({
  page,
  request,
}) => {
  const { id } = await nuovaParita(request);
  await page.goto(`/admin/tappe/${id}/gironi/m`);
  await expect(page).toHaveTitle("Gironi · Amministrazione · BLVS");

  const card = page
    .getByTestId("girone-card")
    .filter({ has: page.getByRole("heading", { name: "Girone A" }) });
  await expect(card.getByTestId("parita-girone")).toContainText(
    "Parità da risolvere",
  );
  // Girone B has no match played: no tie to decide yet.
  await expect(page.getByTestId("parita-girone")).toHaveCount(1);

  await card.getByRole("button", { name: /Risolvi la parità/ }).click();
  const dialog = page.getByRole("dialog", { name: /Parità da risolvere/ });
  await expect(dialog).toBeVisible();
  await expect(dialog.locator("*:focus")).toHaveCount(1);
  await dialog.getByRole("button", { name: "Conferma l'ordine" }).click();
  await expect(dialog).toContainText("Scegli come è stata decisa la parità.");
  await expect(dialog.getByRole("radio", { name: "Sorteggio" })).toBeFocused();
  await expect(page.getByRole("alertdialog")).toHaveCount(0);
  await animazioniFinite(page);
  await expectNoA11yViolations(page);

  // «Altro» needs the free text.
  await dialog.getByRole("radio", { name: "Altro" }).click();
  await dialog.getByRole("button", { name: "Conferma l'ordine" }).click();
  await expect(dialog).toContainText("Scrivi come è stata decisa la parità.");
  await dialog.getByLabel(/Dettagli/).fill("Decide il giudice arbitro");
  await dialog.getByRole("button", { name: "Conferma l'ordine" }).click();
  await page
    .getByRole("alertdialog")
    .getByRole("button", { name: "Sì, decidi l'ordine" })
    .click();
  await expect(page.getByTestId("parita-esito")).toHaveText(
    "Girone A: ordine deciso. 2º Marco Bianchi, 3º Paolo Marino, 4º Andrea Greco.",
  );
  await expect(card).toContainText("Decide il giudice arbitro");
});

test("nessuno scroll orizzontale nel dialog con testo al 200%", async ({
  page,
  request,
}) => {
  const { id } = await nuovaParita(request);
  await page.goto(`/admin/tappe/${id}/live/m`);
  await page.addStyleTag({ content: "html { font-size: 200% !important; }" });
  await page
    .getByRole("button", { name: "Risolvi la parità del Girone A" })
    .click();
  const dialog = page.getByRole("dialog", { name: /Parità da risolvere/ });
  await expect(dialog).toBeVisible();
  await animazioniFinite(page);
  for (const width of [1440, 768, 390]) {
    await page.setViewportSize({ width, height: 900 });
    await nessunoScrollOrizzontale(dialog, `a ${width}px con testo 200%`);
  }
});
