import type { APIRequestContext, Page } from "@playwright/test";
import { expect, expectNoA11yViolations, test } from "./fixtures";
import { waitForAnimations } from "./storybook-helpers";

/**
 * BLVS-43 «Concludi tabellone» on the in-memory demo (no Supabase in e2e).
 * Each test creates its own stage, both boards in the finals, through the
 * demo-only POST /api/demo/chiusura-tabellone: the server and the live bus
 * are shared by parallel projects.
 */
async function creaTappa(
  request: APIRequestContext,
  scenario: "finali_concluse" | "parita" = "finali_concluse",
) {
  const response = await request.post("/api/demo/chiusura-tabellone", {
    data: { scenario },
  });
  expect(response.status()).toBe(201);
  return ((await response.json()) as { id: string }).id;
}

/** SSE keeps a request open: wait for the live bar, never networkidle. */
async function apriLive(page: Page, id: string, categoria: "m" | "f" = "m") {
  await page.goto(`/admin/tappe/${id}/live/${categoria}`);
  await expect(page.getByTestId("admin-live")).toBeVisible();
  await expect(
    page.getByRole("region", { name: "Stato degli aggiornamenti" }),
  ).toHaveAttribute("data-status", "live");
}

async function apriDialog(page: Page) {
  const trigger = page.getByRole("button", { name: "Concludi tabellone" });
  await trigger.focus();
  await page.keyboard.press("Enter");
  const dialog = page.getByRole("alertdialog", {
    name: /Concludere il tabellone/,
  });
  await expect(dialog).toBeVisible();
  // Keys must reach the dialog, not the page behind it.
  await expect(dialog.locator("*:focus")).toHaveCount(1);
  return { trigger, dialog };
}

async function concludi(page: Page, id: string, categoria: "m" | "f") {
  await apriLive(page, id, categoria);
  const { dialog } = await apriDialog(page);
  await dialog
    .getByRole("button", { name: "Sì, concludi il tabellone" })
    .click();
  await expect(page.getByTestId("concludi-tabellone-esito")).toContainText(
    "concluso: i punti sono definitivi",
  );
}

test("concludi tabellone: dialog da tastiera, focus sull'azione sicura, axe", async ({
  page,
  request,
}) => {
  const id = await creaTappa(request);
  await apriLive(page, id);
  await expect(page.getByTestId("fase-tabellone")).toHaveText(
    "Fase del tabellone: Finali",
  );
  await expect(page.getByTestId("punti-stato")).toHaveText("Provvisori");

  const { trigger, dialog } = await apriDialog(page);
  await expect(dialog).toContainText(
    "I punti diventano definitivi e la classifica generale si aggiorna.",
  );
  await expect(
    dialog.getByRole("button", { name: "Non concludere" }),
  ).toBeFocused();
  await waitForAnimations(page);
  await expectNoA11yViolations(page);

  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(trigger).toBeFocused();
});

test("chiusi entrambi i tabelloni: «Conclusa» a testo, punti definitivi, «Archivia» abilitata", async ({
  page,
  request,
}) => {
  test.setTimeout(90_000);
  const id = await creaTappa(request);
  await concludi(page, id, "m");

  // The outcome takes the focus and the phase is said as text.
  await expect(page.getByTestId("concludi-tabellone-esito")).toBeFocused();
  await expect(page.getByTestId("fase-tabellone")).toHaveText(
    "Fase del tabellone: Conclusa",
  );
  await expect(page.getByTestId("avanzamento-fase")).toContainText(
    "Fase: Conclusa",
  );
  await expect(page.getByTestId("punti-stato")).toHaveText("Definitivi");
  await expect(page).toHaveTitle(/Gestione live/);
  await waitForAnimations(page);
  await expectNoA11yViolations(page);

  // One board closed: the stage is still in progress, «Archivia» disabled.
  await page.goto(`/admin/tappe/${id}`);
  const archivia = page.getByRole("button", { name: /^Archivia: / });
  await expect(archivia).toHaveAttribute("aria-disabled", "true");

  await concludi(page, id, "f");
  await expect(page.getByTestId("concludi-tabellone-esito")).toContainText(
    "la tappa è conclusa e si può archiviare",
  );

  await page.goto(`/admin/tappe/${id}`);
  // Table at 1440, cards at 390: the two boards' «Conclusa» badges.
  const conclusi = page
    .locator('[data-fase="conclusa"]')
    .filter({ visible: true });
  await expect(conclusi).toHaveCount(2);
  await expect(conclusi.first()).toHaveText("Conclusa");
  await expect(
    page.getByRole("button", { name: /^Archivia: / }),
  ).not.toHaveAttribute("aria-disabled", "true");
  await expect(page).toHaveTitle(/Gestione tappa/);
  await expectNoA11yViolations(page);
});

test("il server rifiuta la chiusura con una parità da risolvere", async ({
  page,
  request,
}) => {
  const id = await creaTappa(request, "parita");
  await apriLive(page, id);
  const { dialog } = await apriDialog(page);
  await dialog
    .getByRole("button", { name: "Sì, concludi il tabellone" })
    .click();
  await expect(dialog.getByRole("alert")).toContainText(
    "c'è una parità da risolvere (Finale gold)",
  );
  await expect(
    dialog.getByRole("link", { name: "Risolvi parità" }),
  ).toHaveAttribute("href", new RegExp(`#girone-live-${id}-M-finale_gold$`));
  await waitForAnimations(page);
  await expectNoA11yViolations(page);
});

test("una correzione su tabellone concluso chiede conferma con i punti che cambiano", async ({
  page,
  request,
}) => {
  test.setTimeout(90_000);
  const id = await creaTappa(request);
  await concludi(page, id, "m");

  const voce = page
    .getByTestId("tutte-le-partite")
    .locator(`[data-partita="${id}-M-finale_gold-t1"]`);
  await voce
    .getByRole("button", { name: "Correggi punteggio: Finale gold · turno 1" })
    .click();
  const form = page.getByTestId("punteggio-form");
  await expect(form).toBeVisible();
  const set1 = form.getByRole("group", { name: "Set 1" });
  await set1.getByRole("textbox").first().fill("10");
  await set1.getByRole("textbox").last().fill("21");
  await form.getByRole("button", { name: "Salva" }).click();

  const conferma = form.getByTestId("conferma-concluso");
  await expect(conferma).toContainText(
    "Tabellone concluso: confermi la correzione?",
  );
  await expect(
    conferma.getByRole("list", { name: "Punti che cambiano" }),
  ).toBeVisible();
  await expect(
    conferma.getByRole("listitem").filter({ hasText: "→" }).first(),
  ).toBeVisible();
  await waitForAnimations(page);
  await expectNoA11yViolations(page);

  await form.getByRole("button", { name: "Sì, correggi il punteggio" }).click();
  await expect(page.getByTestId("admin-live-esito")).toContainText(
    "punteggio corretto su tabellone concluso 10-21",
  );
  await expect(page.getByTestId("fase-tabellone")).toHaveText(
    "Fase del tabellone: Conclusa",
  );

  // Closing and correction are in the registro.
  await page.goto(`/admin/tappe/${id}/registro`);
  await expect(
    page.getByText("Chiusura del tabellone").filter({ visible: true }).first(),
  ).toBeVisible();
  await expect(
    page
      .getByText("Correzione su tabellone concluso")
      .filter({ visible: true })
      .first(),
  ).toBeVisible();
});

test("la dashboard dice «Conclusa» a testo per i tabelloni chiusi", async ({
  page,
}) => {
  await page.goto("/admin");
  // Tappa 0 · Lignano: both boards closed in the demo calendar.
  const lignano = page
    .locator('[data-slot="categoria-cell"]')
    .filter({ visible: true })
    .filter({ hasText: "Conclusa" });
  await expect(lignano).toHaveCount(2);
});
