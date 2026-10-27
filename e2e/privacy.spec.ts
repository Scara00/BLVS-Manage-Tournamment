import type { Page } from "@playwright/test";
import { PRIVACY_POLICY_VERSION } from "../src/lib/legal/privacy-policy";
import { expect, expectNoA11yViolations, test } from "./fixtures";

const WIDTHS = [1440, 1024, 768, 390];

async function expectNoHorizontalScroll(page: Page, label: string) {
  const { scrollWidth, clientWidth } = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  expect(scrollWidth, `scroll orizzontale ${label}`).toBeLessThanOrEqual(
    clientWidth,
  );
}

test.describe("informativa privacy", () => {
  test.use({ reducedMotion: "reduce" });

  test("rispetta WCAG 2.2 AA ed espone la versione", async ({ page }) => {
    await page.goto("/privacy?da=/classifica");
    await expect(page).toHaveTitle("Informativa privacy · BLVS");
    await expect(
      page.getByRole("heading", { level: 1, name: "Informativa privacy" }),
    ).toBeVisible();
    const version = page.getByTestId("privacy-version");
    await expect(version).toHaveAttribute(
      "data-version",
      PRIVACY_POLICY_VERSION.number,
    );
    await expect(version).toHaveAttribute(
      "data-version-date",
      PRIVACY_POLICY_VERSION.date,
    );
    await expect(page.getByText("L'email non compare mai")).toBeVisible();
    await expectNoA11yViolations(page);
  });

  test("nella barra in alto c'è solo il link per tornare indietro", async ({
    page,
  }) => {
    await page.goto("/privacy");
    const banner = page.getByRole("banner");
    await expect(banner.locator("a, button")).toHaveCount(1);
    await expect(banner.getByRole("link", { name: "Indietro" })).toBeVisible();
    await expectNoA11yViolations(page);
  });

  test("il pulsante in fondo riporta alla pagina di origine", async ({
    page,
  }) => {
    await page.goto("/privacy?da=/classifica");
    await page.waitForLoadState("networkidle");
    await expectNoA11yViolations(page);
    await page
      .getByRole("link", { name: "Torna alla pagina precedente" })
      .click();
    await expect(page).toHaveURL("/classifica");
  });

  test("rifiuta i percorsi esterni e torna alla home", async ({ page }) => {
    for (const da of [
      "https://example.com",
      "//example.com",
      "/\\example.com",
    ]) {
      await page.goto(`/privacy?da=${encodeURIComponent(da)}`);
      await page.waitForLoadState("networkidle");
      await expect(
        page.getByRole("link", { name: "Torna alla pagina precedente" }),
      ).toHaveAttribute("href", "/");
      await expect(
        page.getByRole("banner").getByRole("link", { name: "Indietro" }),
      ).toHaveAttribute("href", "/");
    }
    await expectNoA11yViolations(page);
  });

  test("l'indice si usa da tastiera e segna la sezione attiva", async ({
    page,
  }) => {
    await page.goto("/privacy?da=/tappe");
    await page.waitForLoadState("networkidle");
    await page.keyboard.press("Tab");
    await expect(
      page.getByRole("link", { name: "Vai al contenuto" }),
    ).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(page.getByRole("link", { name: "Indietro" })).toBeFocused();

    const index = page.getByRole("navigation", { name: "Indice" });
    const target = index.getByRole("link", {
      name: "Cosa compare in classifiche e pagine live",
    });
    // Tab through the index until the link is reached: no traps, DOM order.
    for (let i = 0; i < 10; i++) {
      if (await target.evaluate((el) => el === document.activeElement)) break;
      await page.keyboard.press("Tab");
    }
    await expect(target).toBeFocused();
    await page.keyboard.press("Enter");

    await expect(page).toHaveURL(/#cosa-e-pubblico$/);
    await expect(page.locator("#cosa-e-pubblico")).toBeFocused();
    await expect(target).toHaveAttribute("aria-current", "location");
    await expect(index.locator("[aria-current]")).toHaveCount(1);
    await expectNoA11yViolations(page);
  });

  test("testo al 200% senza scroll orizzontale fino a 390 px", async ({
    page,
  }) => {
    await page.goto("/privacy");
    await page.addStyleTag({ content: "html { font-size: 200% !important; }" });
    for (const width of WIDTHS) {
      await page.setViewportSize({ width, height: 900 });
      await expectNoHorizontalScroll(page, `a ${width}px con testo 200%`);
      await expect(page.getByRole("link", { name: "Indietro" })).toBeVisible();
    }
    await expectNoA11yViolations(page);
  });
});

test("con movimento ridotto la riga d'esempio non anima", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/privacy");
  await page.waitForLoadState("networkidle");
  const table = page.getByRole("table", {
    name: "Esempio di riga in classifica",
  });
  await expect(table).toContainText("385");
  expect(
    await table.evaluate((el) => el.getAnimations({ subtree: true }).length),
  ).toBe(0);
  await expectNoA11yViolations(page);
});

test("il footer delle pagine porta all'informativa e ritorna", async ({
  page,
}) => {
  await page.goto("/tappe");
  await page.waitForLoadState("networkidle");
  await expectNoA11yViolations(page);
  const footerLink = page
    .getByRole("contentinfo")
    .getByRole("link", { name: "Informativa privacy" });
  await expect(footerLink).toHaveAttribute("href", "/privacy?da=%2Ftappe");
  await footerLink.click();
  await expect(page).toHaveURL("/privacy?da=%2Ftappe");
  await page.waitForLoadState("networkidle");
  await page.getByRole("link", { name: "Indietro" }).click();
  await expect(page).toHaveURL("/tappe");
});
