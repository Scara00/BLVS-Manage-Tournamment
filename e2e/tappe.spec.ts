import { expect, expectNoA11yViolations, test } from "./fixtures";

/*
 * w-tappe with the demo data (no Supabase in e2e): a draft that must never
 * appear, a cancelled stage, a stage in progress for the live strip.
 */

test("elenco delle tappe: niente bozze, annullata a testo, striscia live", async ({
  page,
}) => {
  await page.goto("/tappe");
  await expect(page).toHaveTitle("Tappe · BLVS");
  await expect(
    page.getByRole("heading", { level: 1, name: "Tappe" }),
  ).toBeVisible();

  const strip = page.getByRole("region", { name: /^In corso: Tappa 1/ });
  await expect(strip).toBeVisible();
  await expect(strip).toContainText("Fase Gironi");
  await expect(
    strip.getByRole("link", { name: "Segui il live" }),
  ).toHaveAttribute("href", "/tappe/jesolo/live");

  await expect(page.getByText(/Lignano/)).toHaveCount(0);

  const annullata = page.locator(
    '[data-stato="annullata"][data-tappa]:visible',
  );
  await expect(annullata).toHaveCount(1);
  await expect(annullata).toContainText("Annullata");
  await expect(annullata.getByRole("link", { name: /Iscriviti/ })).toHaveCount(
    0,
  );

  await expect(
    page.getByRole("link", { name: "Iscriviti a Tappa 2 · Rimini" }),
  ).toBeVisible();
  await expect(
    page.getByText("5 liberi su 16").filter({ visible: true }),
  ).toBeVisible();

  await expectNoA11yViolations(page);
});

test("a 1440 è una tabella con le intestazioni, a 390 le righe sono schede", async ({
  page,
}, testInfo) => {
  await page.goto("/tappe");
  const table = page.getByRole("table", { name: "Calendario delle tappe" });
  const cards = page.getByRole("list", { name: "Calendario delle tappe" });

  if (testInfo.project.name === "desktop-1440") {
    await expect(table).toBeVisible();
    await expect(cards).toBeHidden();
    await expect(table.getByRole("columnheader")).toHaveText([
      "Tappa",
      "Data",
      "Luogo",
      "Scadenza iscrizioni",
      "Posti",
      "Stato",
      "Fase",
      "Iscrizione",
    ]);
    await expect(table.getByRole("rowheader")).toHaveCount(4);
  } else {
    await expect(table).toBeHidden();
    await expect(cards).toBeVisible();
    await expect(cards.getByRole("listitem")).toHaveCount(4);
  }

  const scrollWidth = await page.evaluate(
    () => document.documentElement.scrollWidth,
  );
  const viewport = page.viewportSize()?.width ?? 0;
  expect(scrollWidth).toBeLessThanOrEqual(viewport);

  await expectNoA11yViolations(page);
});
