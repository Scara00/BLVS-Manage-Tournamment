import type { Page } from "@playwright/test";
import { expect, expectNoA11yViolations, test } from "./fixtures";
import { waitForAnimations } from "./storybook-helpers";

/*
 * w-admin-palette (BLVS-55) on the demo data (no Supabase env): Ctrl/Cmd+K
 * opens an ARIA combobox on every admin page; on touch the «Cerca» button
 * of the Topbar opens it and the key hints are gone.
 */

const isDesktop = (page: Page) => (page.viewportSize()?.width ?? 0) >= 768;

const palette = (page: Page) => page.getByRole("dialog");
const campo = (page: Page) =>
  page.getByRole("combobox", { name: "Cerca tappe, giocatori e partite" });
const apri = (page: Page) =>
  page.getByRole("button", { name: /^Cerca tappe, giocatori e partite/ });

/** Ctrl/Cmd+K, retried until the page has hydrated and the field has focus. */
async function apriDaTastiera(page: Page) {
  await expect(async () => {
    if (!(await campo(page).isVisible())) {
      await page.keyboard.press("ControlOrMeta+k");
    }
    await expect(campo(page)).toBeFocused({ timeout: 1_000 });
  }).toPass({ timeout: 15_000 });
  await waitForAnimations(page);
}

test.describe("da tastiera", () => {
  test.skip(({ page }) => !isDesktop(page), "tastiera: solo desktop");

  test("Ctrl/Cmd+K, frecce e Invio aprono la tappa; nessuna violazione axe", async ({
    page,
  }) => {
    await page.goto("/admin");
    await apriDaTastiera(page);
    await expect(campo(page)).toHaveAttribute("aria-expanded", "true");
    await expect(
      palette(page).getByRole("group", { name: "Comandi" }),
    ).toBeVisible();

    await campo(page).fill("jesolo");
    const tappe = palette(page).getByRole("group", { name: "Tappe" });
    await expect(tappe).toBeVisible();
    await expect(page.getByTestId("palette-stato")).toContainText(
      /risultat[io] per «jesolo»/,
    );
    await expect(
      palette(page).getByRole("group", { name: "Partite" }),
    ).toBeVisible();

    // Rows are at least 48px tall.
    for (const box of await palette(page)
      .getByRole("option")
      .evaluateAll((els) => els.map((el) => el.getBoundingClientRect().height)))
      expect(box).toBeGreaterThanOrEqual(48);

    await page.keyboard.press("ArrowDown");
    const prima = tappe.getByRole("option").first();
    await expect(prima).toHaveAttribute("aria-selected", "true");
    const id = await prima.getAttribute("id");
    await expect(campo(page)).toHaveAttribute("aria-activedescendant", id!);
    await expect(campo(page)).toBeFocused();

    await waitForAnimations(page);
    await expectNoA11yViolations(page);

    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/admin\/tappe\/jesolo$/);
    await expect(palette(page)).toBeHidden();
  });

  test("Esc chiude e riporta il focus dove era", async ({ page }) => {
    await page.goto("/admin");
    const dashboard = page
      .getByRole("navigation", { name: "Amministrazione" })
      .getByRole("link", { name: "Tappe" })
      .first();
    await dashboard.focus();
    await apriDaTastiera(page);
    await page.keyboard.press("Escape");
    await expect(palette(page)).toBeHidden();
    await expect(dashboard).toBeFocused();
  });

  test("con un puntatore preciso mostra i tasti", async ({ page }) => {
    await page.goto("/admin/tappe");
    await expect(
      apri(page).locator("[data-slot=palette-scorciatoia]"),
    ).toBeVisible();
    await apriDaTastiera(page);
    await expect(page.locator("[data-slot=palette-tasti]")).toBeVisible();
  });
});

test("nessuna barra fissa copre la palette, anche con il testo al 200%", async ({
  page,
}) => {
  await page.goto("/admin");
  await page.addStyleTag({ content: "html { font-size: 200% !important; }" });
  await apri(page).click();
  await expect(campo(page)).toBeFocused();
  await campo(page).fill("jesolo");
  await expect(
    palette(page).getByRole("group", { name: "Tappe" }),
  ).toBeVisible();
  await waitForAnimations(page);

  const viewport = page.viewportSize()!;
  const box = (await palette(page).boundingBox())!;
  expect(box.y).toBeGreaterThanOrEqual(0);
  expect(box.y + box.height).toBeLessThanOrEqual(viewport.height);
  expect(box.x + box.width).toBeLessThanOrEqual(viewport.width);

  // The field and the first option are on top: no topbar or toast over them.
  for (const target of [
    campo(page),
    palette(page).getByRole("option").first(),
  ]) {
    const coperto = await target.evaluate((el) => {
      const r = el.getBoundingClientRect();
      const sopra = document.elementFromPoint(r.left + 8, r.top + r.height / 2);
      return !(sopra && (el === sopra || el.contains(sopra)));
    });
    expect(coperto).toBe(false);
  }
  const scrollOrizzontale = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth,
  );
  expect(scrollOrizzontale).toBe(false);
});

test.describe("touch", () => {
  test.skip(({ page }) => isDesktop(page), "touch: solo mobile");

  test("si apre dal pulsante «Cerca», i tasti spariscono; un tocco apre il comando", async ({
    page,
  }) => {
    await page.goto("/admin");
    await expect(
      apri(page).locator("[data-slot=palette-scorciatoia]"),
    ).toBeHidden();
    await apri(page).tap();
    await expect(palette(page)).toBeVisible();
    await expect(page.locator("[data-slot=palette-tasti]")).toBeHidden();
    await waitForAnimations(page);
    await expectNoA11yViolations(page);

    await palette(page)
      .getByRole("option", { name: /Nuova tappa/ })
      .tap();
    await expect(page).toHaveURL(/\/admin\/tappe\/nuova$/);
  });

  test("«Chiudi» chiude la palette", async ({ page }) => {
    await page.goto("/admin");
    await apri(page).tap();
    await palette(page).getByRole("button", { name: "Chiudi" }).tap();
    await expect(palette(page)).toBeHidden();
  });
});
