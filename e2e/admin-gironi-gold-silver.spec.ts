import type { APIRequestContext, Page } from "@playwright/test";
import { expect, expectNoA11yViolations, test } from "./fixtures";
import { waitForAnimations } from "./storybook-helpers";

/**
 * BLVS-39 on the in-memory demo stores (no Supabase in e2e): the
 * gold/silver proposal in the groups editor, the tie that blocks it, the
 * start of the gold/silver groups and the finals. Each test creates its own
 * stage through the demo-only POST /api/demo/fasi.
 */
async function creaTappa(
  request: APIRequestContext,
  scenario: "iniziali_concluse" | "parita" | "gold_silver_concluse",
) {
  const response = await request.post("/api/demo/fasi", { data: { scenario } });
  expect(response.status()).toBe(201);
  return ((await response.json()) as { id: string }).id;
}

async function apri(page: Page, path: string, testId: string) {
  await page.goto(path);
  await expect(page.getByTestId(testId)).toBeVisible();
  // Client buttons hydrate after the streamed content.
  await page.waitForLoadState("networkidle");
}

async function proponi(page: Page) {
  await page
    .getByRole("button", { name: "Proponi i gironi gold e silver" })
    .click();
  const dialog = page.getByRole("alertdialog", {
    name: "Proporre i gironi gold e silver del tabellone maschile?",
  });
  await expect(dialog).toBeVisible();
  await expect(dialog.locator("*:focus")).toHaveCount(1);
  await dialog.getByRole("button", { name: "Proponi" }).click();
  await expect(page.getByTestId("prossima-fase-esito")).toBeFocused();
}

test("proposta gold/silver nell'editor: da controllare e modificare prima dell'avvio", async ({
  page,
  request,
}) => {
  const id = await creaTappa(request, "iniziali_concluse");
  await apri(page, `/admin/tappe/${id}/gironi/m`, "prossima-fase-gold_silver");

  const pannello = page.getByTestId("prossima-fase-gold_silver");
  await expect(pannello.getByTestId("fase-tabellone")).toHaveText(
    "Gironi iniziali",
  );
  await expect(pannello.getByTestId("girone-proposto")).toHaveCount(4);
  await expect(pannello.getByTestId("girone-proposto").first()).toContainText(
    "1° Girone A",
  );
  await expectNoA11yViolations(page);

  await proponi(page);
  await expect(page.getByTestId("prossima-fase-gold_silver")).toHaveAttribute(
    "data-stato",
    "proposta",
  );
  // The editor now shows the gold and silver groups, still editable.
  const editor = page.getByTestId("gironi-editor");
  await expect(editor.getByTestId("girone-card")).toHaveCount(4);
  await expect(editor.getByTestId("girone-card").first()).toContainText(
    "Gold A",
  );
  await expect(
    editor.getByRole("button", { name: "Aggiungi girone silver" }),
  ).toBeVisible();
  await expect(page).toHaveTitle(/Gironi/);
  await expectNoA11yViolations(page);

  await editor.getByRole("button", { name: "Aggiungi girone silver" }).click();
  await expect(page.getByTestId("annuncio-gironi")).toContainText(
    "Silver C aggiunto.",
  );
  await expect(editor.getByTestId("girone-card")).toHaveCount(5);
});

test("una parità blocca la proposta con «Risolvi parità», risolta la proposta parte", async ({
  page,
  request,
}) => {
  const id = await creaTappa(request, "parita");
  await apri(page, `/admin/tappe/${id}/gironi/m`, "prossima-fase-gold_silver");

  const parita = page.getByTestId("parita-da-risolvere");
  await expect(parita).toContainText("C'è una parità da risolvere");
  const link = page.getByRole("link", { name: "Risolvi parità nel Girone A" });
  await expect(link).toHaveAttribute(
    "href",
    new RegExp(`/admin/tappe/${id}/gironi/m#girone-`),
  );
  await expect(
    page.getByRole("button", { name: "Proponi i gironi gold e silver" }),
  ).toHaveCount(0);
  await expectNoA11yViolations(page);

  // The admin resolves the tie (BLVS-38's dialog; here the demo fixture).
  const risolta = await request.post("/api/demo/fasi", {
    data: { tappaId: id, risolvi: true },
  });
  expect(risolta.ok()).toBe(true);
  await apri(page, `/admin/tappe/${id}/gironi/m`, "prossima-fase-gold_silver");
  await expect(page.getByTestId("parita-da-risolvere")).toHaveCount(0);
  await proponi(page);
});

test("avvio dei gironi gold e silver: fase a testo in gestione live", async ({
  page,
  request,
}) => {
  const id = await creaTappa(request, "iniziali_concluse");
  await apri(page, `/admin/tappe/${id}/gironi/m`, "prossima-fase-gold_silver");
  await proponi(page);
  await page
    .getByRole("link", { name: "Vai all'avvio dei gironi gold e silver" })
    .click();
  await expect(page.getByTestId("avvio-fase")).toBeVisible();
  await page.waitForLoadState("networkidle");
  await expect(page).toHaveTitle(/Avvio fase/);
  await expectNoA11yViolations(page);

  await page.getByRole("button", { name: "Avvia le 12 partite" }).click();
  const dialog = page.getByRole("alertdialog", {
    name: "Avviare i gironi gold e silver del tabellone maschile?",
  });
  await expect(dialog).toBeVisible();
  await waitForAnimations(page);
  await expectNoA11yViolations(page);
  await dialog.getByRole("button", { name: "Avvia" }).click();

  await expect(page).toHaveURL(new RegExp(`/admin/tappe/${id}/live/m$`));
  await expect(page.getByText("Fase: Gironi gold e silver")).toBeVisible();
  await expect(page.getByTestId("avanzamento")).toHaveText(
    "0 di 12 partite concluse",
  );
});

test("concluse gold e silver, genera la finale gold e la finale silver", async ({
  page,
  request,
}) => {
  const id = await creaTappa(request, "gold_silver_concluse");
  await apri(page, `/admin/tappe/${id}/avvio/m`, "prossima-fase-finali");

  const pannello = page.getByTestId("prossima-fase-finali");
  await expect(pannello.getByTestId("fase-tabellone")).toHaveText(
    "Gironi gold e silver",
  );
  await expect(pannello.getByTestId("girone-proposto")).toHaveCount(2);
  await expectNoA11yViolations(page);

  await pannello.getByRole("button", { name: "Genera le finali" }).click();
  const dialog = page.getByRole("alertdialog", {
    name: "Generare le finali del tabellone maschile?",
  });
  await expect(dialog).toBeVisible();
  await waitForAnimations(page);
  await expectNoA11yViolations(page);
  await dialog.getByRole("button", { name: "Genera" }).click();

  await expect(page.getByTestId("prossima-fase-esito")).toBeFocused();
  await expect(page.getByTestId("prossima-fase-esito")).toHaveText(
    "Finali generate: le partite sono da giocare.",
  );
  await expect(pannello.getByTestId("fase-tabellone")).toHaveText("Finali");

  await page.goto(`/admin/tappe/${id}/live/m`);
  await expect(page.getByText("Fase: Finali")).toBeVisible();
  await expect(page.getByTestId("avanzamento")).toHaveText(
    "0 di 6 partite concluse",
  );
});
