import type { APIRequestContext, Page } from "@playwright/test";
import { expect, expectNoA11yViolations, test } from "./fixtures";

/**
 * w-admin-rigenera-conferma inside w-admin-gironi, on the demo store (no
 * Supabase env). Every test gets its own board with N scores through
 * POST /api/demo/rigenera-gironi, because the server is shared by
 * parallel projects and outlives runs. The RPC (delete, draw, log entry)
 * is covered by the PGlite tests.
 */
async function nuovoTabellone(request: APIRequestContext, punteggi: number) {
  const response = await request.post("/api/demo/rigenera-gironi", {
    data: { punteggi },
  });
  expect(response.status()).toBe(201);
  const { id } = (await response.json()) as { id: string };
  return `/admin/tappe/${id}/gironi/m`;
}

async function apri(page: Page, path: string) {
  await page.goto(path);
  await expect(page).toHaveTitle("Gironi · Amministrazione · BLVS");
  await expect(page.getByTestId("rigenera-gironi")).toBeVisible();
  await page.waitForLoadState("networkidle");
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

/** Presses Tab until the focused element has this accessible name. */
async function tabFino(page: Page, nome: string) {
  for (let i = 0; i < 150; i += 1) {
    await page.keyboard.press("Tab");
    const testo = await page.evaluate(() => {
      const el = document.activeElement;
      return el?.getAttribute("aria-label") ?? el?.textContent?.trim() ?? "";
    });
    if (testo === nome) return;
  }
  throw new Error(`«${nome}» non raggiunto con Tab`);
}

test("senza punteggi la rigenerazione è diretta", async ({ page, request }) => {
  await apri(page, await nuovoTabellone(request, 0));
  const sezione = page.getByTestId("rigenera-gironi");
  await expect(sezione).toContainText("la rigenerazione è immediata");
  await expectNoA11yViolations(page);

  await tabFino(page, "Rigenera gironi");
  await page.keyboard.press("Enter");
  const esito = page.getByTestId("rigenera-esito");
  await expect(esito).toHaveText("Gironi rigenerati: 4 gironi.");
  await expect(esito).toBeFocused();
  await expect(page.getByRole("alertdialog")).toHaveCount(0);
});

test("con punteggi: conferma accessibile e tutta da tastiera", async ({
  page,
  request,
}) => {
  await apri(page, await nuovoTabellone(request, 3));
  await expect(page.getByTestId("gironi-bloccati")).toBeVisible();

  await tabFino(page, "Rigenera gironi");
  await page.keyboard.press("Enter");
  const dialog = page.getByRole("alertdialog", {
    name: "Rigenerare i gironi?",
  });
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText(
    "Rigenerando perdi 3 punteggi già inseriti.",
  );
  await expect(
    dialog.getByRole("list", { name: "Punteggi che si perdono" }).locator("li"),
  ).toHaveCount(3);
  // Focus starts on «Annulla», the safe action.
  await expect(dialog.getByRole("button", { name: "Annulla" })).toBeFocused();
  await animazioniFinite(page);
  await expectNoA11yViolations(page);

  // The confirm button stays active: without the tick, the error appears
  // next to the box, which receives focus.
  const conferma = dialog.getByRole("button", {
    name: "Rigenera e perdi 3 punteggi",
  });
  await page.keyboard.press("Tab");
  await expect(conferma).toBeFocused();
  await page.keyboard.press("Enter");
  const casella = dialog.getByRole("checkbox", {
    name: "Ho capito che i 3 punteggi inseriti si perdono",
  });
  await expect(casella).toBeFocused();
  await expect(casella).toHaveAttribute("aria-invalid", "true");
  await expect(dialog).toContainText(
    "Spunta la casella per confermare che perdi 3 punteggi.",
  );
  await animazioniFinite(page);
  await expectNoA11yViolations(page);

  // Space ticks it, then Tab back to the confirm button.
  await page.keyboard.press("Space");
  await expect(casella).toBeChecked();
  await tabFino(page, "Rigenera e perdi 3 punteggi");
  await page.keyboard.press("Enter");

  await expect(dialog).toHaveCount(0);
  const esito = page.getByTestId("rigenera-esito");
  await expect(esito).toHaveText(
    "Gironi rigenerati: 4 gironi. Persi 3 punteggi, annotati nel registro.",
  );
  await expect(esito).toBeFocused();
  // New groups, no scores: the editor is editable again.
  await expect(page.getByTestId("gironi-bloccati")).toHaveCount(0);
  await expect(page.getByTestId("rigenera-gironi")).toContainText(
    "la rigenerazione è immediata",
  );
  await expect(page).toHaveTitle("Gironi · Amministrazione · BLVS");
  await animazioniFinite(page);
  await expectNoA11yViolations(page);
});

test("Esc chiude la conferma senza rigenerare", async ({ page, request }) => {
  await apri(page, await nuovoTabellone(request, 2));
  const trigger = page.getByRole("button", { name: "Rigenera gironi" });
  await trigger.focus();
  await page.keyboard.press("Enter");
  const dialog = page.getByRole("alertdialog");
  await expect(dialog).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(trigger).toBeFocused();
  await expect(page.getByTestId("rigenera-esito")).toHaveText("");
});
