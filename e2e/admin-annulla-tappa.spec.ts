import type { Page } from "@playwright/test";
import { expect, expectNoA11yViolations, test } from "./fixtures";

/*
 * w-admin-annulla-tappa on w-admin-dashboard, with the demo calendar (no
 * Supabase env in e2e): nothing is saved, the action validates and answers
 * that the demo has no database. The emails (Mailpit) are covered by
 * e2e/supabase/annulla-tappa.spec.ts in the CI `supabase` job. Never wait
 * for "networkidle": on race day the dashboard keeps an SSE stream open.
 */

async function apriDashboard(page: Page) {
  await page.goto("/admin");
  await expect(
    page.getByRole("region", { name: "Stato degli aggiornamenti" }),
  ).toHaveAttribute("data-status", "live", { timeout: 15_000 });
}

const trigger = (page: Page, nome: string) =>
  page.getByRole("button", { name: `Annulla tappa: ${nome}` });

test("annulla tappa: da tastiera, focus sull'azione sicura, Esc torna al pulsante", async ({
  page,
}) => {
  await apriDashboard(page);
  const annulla = trigger(page, "Tappa 2 · Rimini");
  await annulla.focus();
  await page.keyboard.press("Enter");

  const dialog = page.getByRole("alertdialog", {
    name: "Annullare «Tappa 2 · Rimini»?",
  });
  await expect(dialog).toBeVisible();
  // 9 + 17 pending or confirmed players in the demo.
  await expect(dialog).toContainText(
    "26 iscritti vedranno la tappa annullata nell'app. Non parte nessuna email",
  );
  await expect(
    dialog.getByRole("button", { name: "Non annullare" }),
  ).toBeFocused();
  await expectNoA11yViolations(page);

  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(annulla).toBeFocused();
});

test("annulla tappa: il motivo è obbligatorio, poi il server risponde", async ({
  page,
}) => {
  await apriDashboard(page);
  await trigger(page, "Tappa 3 · Cagliari").click();
  const dialog = page.getByRole("alertdialog", {
    name: "Annullare «Tappa 3 · Cagliari»?",
  });
  const conferma = dialog.getByRole("button", { name: "Annulla tappa" });
  const motivo = dialog.getByRole("textbox", { name: /Motivo/ });

  await conferma.click();
  await expect(motivo).toBeFocused();
  await expect(motivo).toHaveAttribute("aria-invalid", "true");
  await expect(dialog).toContainText("Indica il motivo dell'annullamento.");

  await motivo.fill("Allerta meteo");
  await conferma.click();
  await expect(dialog.getByRole("alert")).toContainText(
    "versione dimostrativa senza database",
  );
  await expect(motivo).toHaveValue("Allerta meteo");
  await expectNoA11yViolations(page);
});

test("archivia: disattivata con la nota finché i risultati non sono chiusi", async ({
  page,
}) => {
  await apriDashboard(page);
  const rimini = page.getByRole("button", {
    name: "Archivia: Tappa 2 · Rimini",
  });
  await expect(rimini).toHaveAttribute("aria-disabled", "true");
  await expect(rimini).toHaveAccessibleDescription(
    "Sarà possibile archiviare la tappa dopo la chiusura dei risultati.",
  );

  // Lignano is concluded with both boards closed.
  const lignano = page.getByRole("button", {
    name: "Archivia: Tappa 0 · Lignano",
  });
  await expect(lignano).not.toHaveAttribute("aria-disabled", "true");
  await lignano.click();
  const dialog = page.getByRole("alertdialog", {
    name: "Archiviare «Tappa 0 · Lignano»?",
  });
  await expect(
    dialog.getByRole("button", { name: "Non archiviare" }),
  ).toBeFocused();
  await expectNoA11yViolations(page);
});

test("una tappa annullata si legge «Annullata» a testo, con il motivo", async ({
  page,
}) => {
  await page.goto("/admin/tappe?stato=annullata");
  const sezione = page.getByRole("region", { name: "Tappe", exact: true });
  const riga = sezione
    .getByText("Tappa 5 · Olbia")
    .filter({ visible: true })
    .first();
  await expect(riga).toBeVisible();
  await expect(
    sezione.getByText("Annullata", { exact: true }).filter({ visible: true }),
  ).toBeVisible();
  await expect(
    sezione
      .getByText("La spiaggia non è disponibile per lavori del Comune.")
      .filter({ visible: true }),
  ).toBeVisible();
  // Cancelled: no «Annulla tappa», but «Archivia» is enabled.
  await expect(trigger(page, "Tappa 5 · Olbia")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Archivia: Tappa 5 · Olbia" }),
  ).not.toHaveAttribute("aria-disabled", "true");
  await expectNoA11yViolations(page);
});
