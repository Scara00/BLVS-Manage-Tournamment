import type { APIRequestContext, Page } from "@playwright/test";
import { expect, expectNoA11yViolations, test } from "./fixtures";
import { waitForAnimations } from "./storybook-helpers";

/**
 * w-admin-avvio-fase on the in-memory demo groups (no Supabase in e2e).
 * Each test creates its own stage through the demo-only
 * POST /api/demo/avvio-fase, because the server is shared by parallel
 * projects and reused across runs.
 */
async function creaTappa(
  request: APIRequestContext,
  scenario: "pronta" | "bloccata",
) {
  const response = await request.post("/api/demo/avvio-fase", {
    data: { scenario },
  });
  expect(response.status()).toBe(201);
  return ((await response.json()) as { id: string }).id;
}

async function apriAvvio(page: Page, id: string, categoria = "m") {
  await page.goto(`/admin/tappe/${id}/avvio/${categoria}`);
  await expect(page.getByTestId("avvio-fase")).toBeVisible();
  // Client buttons hydrate after the streamed content.
  await page.waitForLoadState("networkidle");
}

test("riepilogo, controlli e anteprima di un tabellone pronto", async ({
  page,
  request,
}) => {
  const id = await creaTappa(request, "pronta");
  await apriAvvio(page, id);

  const riepilogo = page.getByLabel("Riepilogo");
  await expect(riepilogo).toContainText("Gironi2");
  await expect(riepilogo).toContainText("Partite da creare6");
  const controlli = page.getByRole("list", { name: "Controlli" });
  await expect(controlli.getByRole("listitem")).toHaveCount(3);
  await expect(controlli.getByText("Superato")).toHaveCount(3);
  await expect(
    page
      .getByRole("list", { name: "Partite del Girone A" })
      .getByRole("listitem"),
  ).toHaveCount(3);

  await expectNoA11yViolations(page);
});

test("avvio confermato: partite create, tappa in corso", async ({
  page,
  request,
}) => {
  const id = await creaTappa(request, "pronta");
  await apriAvvio(page, id);

  await page.getByRole("button", { name: "Avvia i gironi iniziali" }).click();
  const dialog = page.getByRole("alertdialog", {
    name: "Avviare i gironi iniziali del tabellone maschile?",
  });
  await expect(dialog).toBeVisible();
  await waitForAnimations(page);
  await expectNoA11yViolations(page);
  await dialog.getByRole("button", { name: "Avvia" }).click();

  await expect(page.getByTestId("fase-avviata")).toBeFocused();
  await expect(page.getByLabel("Riepilogo")).toContainText("Partite create6");
  await expect(
    page.getByRole("button", { name: "Avvia i gironi iniziali" }),
  ).toHaveCount(0);
  await expect(page).toHaveTitle(/Avvio fase/);
  // The toast fades in: axe would read its colours mid-animation.
  await expect(page.getByText(/6 partite create/)).toBeVisible();
  await waitForAnimations(page);
  await expectNoA11yViolations(page);

  // The stage moved to «in corso».
  await page.goto(`/admin/tappe/${id}`);
  await expect(page.getByTestId("gestione-tappa")).toContainText("In corso");
});

test("avvio rifiutato: errori annunciati con il link al girone", async ({
  page,
  request,
}) => {
  const id = await creaTappa(request, "bloccata");
  await apriAvvio(page, id);

  const controlli = page.getByRole("list", { name: "Controlli" });
  await expect(controlli.getByText("1 da correggere")).toHaveCount(2);
  await expectNoA11yViolations(page);

  await page.getByRole("button", { name: "Avvia i gironi iniziali" }).click();
  const annuncio = page.getByTestId("avvio-annuncio");
  await expect(annuncio).toHaveAttribute("role", "alert");
  await expect(annuncio).toContainText(
    "La fase non è partita: correggi i gironi indicati e riprova. 2 errori.",
  );
  await expect(
    page.getByRole("heading", { name: "2 problemi da correggere" }),
  ).toBeFocused();

  const errori = page.getByTestId("errori-avvio");
  await expect(errori).toContainText("Girone B: ha 3 giocatori invece di 4.");
  await expect(
    errori.getByRole("link", { name: "Vai al Girone B" }),
  ).toHaveAttribute(
    "href",
    new RegExp(`/admin/tappe/${id}/gironi/m#girone-${id}-M-g2$`),
  );
  await expect(page).toHaveTitle(/Avvio fase/);
  await expectNoA11yViolations(page);
});

test("il tabellone femminile si avvia a parte", async ({ page, request }) => {
  const id = await creaTappa(request, "pronta");
  await apriAvvio(page, id, "f");
  await expect(
    page.getByRole("link", { name: "Tabellone femminile" }),
  ).toHaveAttribute("aria-current", "page");
  await expect(page.getByLabel("Riepilogo")).toContainText(
    "Partite da creare3",
  );
  await expectNoA11yViolations(page);
});
