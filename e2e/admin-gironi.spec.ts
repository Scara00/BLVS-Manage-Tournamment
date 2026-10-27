import type { APIRequestContext, Page } from "@playwright/test";
import { expect, expectNoA11yViolations, test } from "./fixtures";

/**
 * w-admin-gironi + w-admin-sposta on the demo store (no Supabase env).
 * Every test gets its own board through POST /api/demo/gironi, because
 * the server is shared by parallel projects and outlives runs. The RPCs
 * themselves are covered by the PGlite tests.
 */
async function nuovoTabellone(
  request: APIRequestContext,
  data: Record<string, unknown> = { giocatori: 17 },
) {
  const response = await request.post("/api/demo/gironi", { data });
  expect(response.status()).toBe(201);
  const { id } = (await response.json()) as { id: string };
  return `/admin/tappe/${id}/gironi/m`;
}

async function apri(page: Page, path: string) {
  await page.goto(path);
  await expect(page).toHaveTitle("Gironi · Amministrazione · BLVS");
  await expect(
    page.getByRole("heading", { level: 1, name: "Gironi" }),
  ).toBeVisible();
  await page.waitForLoadState("networkidle");
}

const girone = (page: Page, nome: string) =>
  page.getByTestId("girone-card").filter({
    has: page.getByRole("heading", { name: nome, exact: true }),
  });

/** Presses Tab until the focused element has this accessible label. */
async function tabFino(page: Page, nome: string) {
  for (let i = 0; i < 120; i += 1) {
    await page.keyboard.press("Tab");
    const etichetta = await page.evaluate(() => {
      const el = document.activeElement;
      return el?.getAttribute("aria-label") ?? el?.textContent?.trim() ?? "";
    });
    if (etichetta === nome) return;
  }
  throw new Error(`«${nome}» non raggiunto con Tab`);
}

test("l'editor è accessibile, con legenda e controlli", async ({
  page,
  request,
}) => {
  await apri(page, await nuovoTabellone(request));
  await expect(page.getByTestId("girone-card")).toHaveCount(4);
  await expect(page.locator("[data-slot=legenda-fasi]")).toHaveCount(1);
  await expect(page.getByTestId("controlli-gironi")).toContainText(
    "Tutti assegnati: da rivedere",
  );
  // Rows are at least 48 px, «Sposta» at least 44 px.
  const riga = page.getByTestId("giocatore-riga").first();
  expect((await riga.boundingBox())!.height).toBeGreaterThanOrEqual(48);
  const sposta = page.getByRole("button", { name: "Sposta Giulia Bianchi" });
  const box = (await sposta.boundingBox())!;
  expect(Math.min(box.width, box.height)).toBeGreaterThanOrEqual(44);
  await expectNoA11yViolations(page);
});

test("tutto da tastiera: sposta, scambia, aggiungi ed elimina un girone", async ({
  page,
  request,
}) => {
  const path = await nuovoTabellone(request);
  await apri(page, path);
  const annuncio = page.getByTestId("annuncio-gironi");

  // Move: Sposta → 2 (Girone B) → X (no swap) → Enter.
  await tabFino(page, "Sposta Giulia Bianchi");
  await page.keyboard.press("Enter");
  const dialog = page.getByRole("dialog", { name: "Sposta nel girone…" });
  await expect(dialog).toBeVisible();
  // Shortcuts are read inside the dialog: wait for focus to move in.
  await expect(dialog.locator("*:focus")).toHaveCount(1);
  // The fade-in would read as low contrast mid-animation.
  await dialog.evaluate((el) =>
    Promise.all(el.getAnimations({ subtree: true }).map((a) => a.finished)),
  );
  await expectNoA11yViolations(page);
  await page.keyboard.press("2");
  await page.keyboard.press("x");
  await expect(dialog.getByRole("radio", { name: /Nessuno/ })).toBeChecked();
  await page.keyboard.press("Enter");
  await expect(dialog).toBeHidden();
  await expect(annuncio).toHaveText(
    /^Giulia Bianchi spostato nel Girone B\. 2 controlli da rivedere/,
  );
  await expect(girone(page, "Girone B")).toContainText("Giulia Bianchi");
  await expect(
    girone(page, "Girone B").getByRole("button", {
      name: "Sposta Giulia Bianchi",
    }),
  ).toBeFocused();
  await expect(page.getByTestId("controlli-gironi")).toContainText(
    "Girone A: 3 giocatori su 4.",
  );

  // Swap: from the focused «Sposta», 1 = Girone A, A = its first player.
  await page.keyboard.press("Enter");
  await expect(dialog).toBeVisible();
  // Shortcuts are read inside the dialog: wait for focus to move in.
  await expect(dialog.locator("*:focus")).toHaveCount(1);
  await page.keyboard.press("1");
  await page.keyboard.press("a");
  await expect(
    dialog.getByRole("radio", { name: /Marco Rossi/ }),
  ).toBeChecked();
  await page.keyboard.press("Enter");
  await expect(annuncio).toHaveText(/^Scambiati Giulia Bianchi e Marco Rossi/);
  await expect(girone(page, "Girone A")).toContainText("Giulia Bianchi");
  await expect(girone(page, "Girone B")).toContainText("Marco Rossi");

  // Add a group: focus goes to its heading.
  await tabFino(page, "Aggiungi girone");
  await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { name: "Girone E" })).toBeFocused();
  await expect(annuncio).toHaveText(/^Girone E aggiunto\./);

  // Delete it, confirming in the alert dialog.
  await tabFino(page, "Elimina Girone E");
  await page.keyboard.press("Enter");
  const conferma = page.getByRole("alertdialog", {
    name: "Eliminare il Girone E?",
  });
  await expect(conferma).toBeVisible();
  // Focus starts on the safe «Annulla»; Tab reaches the confirm button.
  await expect(conferma.getByRole("button", { name: "Annulla" })).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(
    conferma.getByRole("button", { name: "Elimina Girone E" }),
  ).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.getByTestId("girone-card")).toHaveCount(4);
  await expect(annuncio).toHaveText(/^Girone E eliminato\./);
  await expectNoA11yViolations(page);

  // Saved at every change: still there after a reload.
  await apri(page, path);
  await expect(girone(page, "Girone A")).toContainText("Giulia Bianchi");
  await expect(page.getByTestId("girone-card")).toHaveCount(4);
});

test("trascinando un giocatore su un altro girone lo sposta", async ({
  page,
  request,
}, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-1440", "drag and drop: desktop");
  await apri(page, await nuovoTabellone(request));
  const riga = page
    .getByTestId("giocatore-riga")
    .filter({ hasText: "Marco Rossi" });
  await riga.dragTo(
    girone(page, "Girone C").getByRole("heading", { name: "Girone C" }),
  );
  await expect(page.getByTestId("annuncio-gironi")).toHaveText(
    /^Marco Rossi spostato nel Girone C\./,
  );
  await expect(girone(page, "Girone C")).toContainText("Marco Rossi");
});

test("dalla tappa si apre l'editor del tabellone", async ({ page }) => {
  await page.goto("/admin/tappe/rimini");
  await page
    .getByRole("link", { name: "Modifica gironi del tabellone maschile" })
    .filter({ visible: true })
    .click();
  await expect(page).toHaveURL(/\/admin\/tappe\/rimini\/gironi\/m$/);
  await expect(
    page.getByRole("heading", { level: 1, name: "Gironi" }),
  ).toBeVisible();
  await expect(page.getByTestId("gironi-editor")).toContainText(
    "Tappa 2 · Rimini",
  );
  await expectNoA11yViolations(page);
});
