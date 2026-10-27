import type { Page } from "@playwright/test";
import { expect, expectNoA11yViolations, test } from "./fixtures";

/** Every error page, with the actions in Tab order inside `main`. */
const PAGES = [
  {
    name: "404",
    path: "/questa-rotta-non-esiste",
    title: "Pagina non trovata · BLVS",
    h1: "Pagina non trovata",
    actions: ["Vai alle tappe", "Torna alla home"],
  },
  {
    name: "404 admin",
    path: "/admin/rotta-che-non-esiste",
    title: "Pagina non trovata · BLVS",
    h1: "Pagina non trovata",
    actions: ["Vai alle tappe", "Torna alla home"],
  },
  {
    name: "403",
    path: "/admin/anteprima/403",
    title: "Accesso negato · BLVS",
    h1: "Accesso negato",
    actions: ["Torna alla home", "Vai alle tappe"],
  },
  {
    name: "503",
    path: "/anteprima/503",
    title: "Servizio non disponibile · BLVS",
    h1: "Servizio non disponibile",
    actions: ["Riprova", "Torna al modulo", "Home"],
  },
] as const;

const WIDTHS = [1440, 1024, 768, 390];

async function open(page: Page, path: string, h1: string) {
  await page.goto(path);
  await page.waitForLoadState("networkidle");
  await expect(page.getByRole("heading", { level: 1, name: h1 })).toBeVisible();
}

function action(page: Page, name: string) {
  return page
    .getByRole("main")
    .getByRole(name === "Riprova" ? "button" : "link", {
      name,
      exact: true,
    });
}

test.describe("stato HTTP", () => {
  for (const path of [
    "/questa-rotta-non-esiste",
    "/tappe/tappa-inesistente",
    "/admin/rotta-che-non-esiste",
    "/admin/tappe/a/b",
  ]) {
    test(`${path} risponde 404`, async ({ request }) => {
      expect((await request.get(path)).status()).toBe(404);
    });
  }

  test("forbidden() risponde 403", async ({ request }) => {
    expect((await request.get("/admin/anteprima/403")).status()).toBe(403);
  });
});

for (const { name, path, title, h1, actions } of PAGES) {
  test.describe(`pagina ${name}`, () => {
    test("titolo, h1 testuale e WCAG 2.2 AA", async ({ page }) => {
      await open(page, path, h1);
      await expect(page).toHaveTitle(title);
      await expect(page.getByRole("banner")).toBeVisible();
      await expectNoA11yViolations(page);
    });

    test("solo tastiera: skip link, poi le azioni in ordine", async ({
      page,
    }) => {
      await open(page, path, h1);
      await page.keyboard.press("Tab");
      await expect(
        page.getByRole("link", { name: "Vai al contenuto" }),
      ).toBeFocused();
      await page.keyboard.press("Enter");
      await expect(page.getByRole("main")).toBeFocused();
      for (const label of actions) {
        await page.keyboard.press("Tab");
        const target = action(page, label);
        await expect(target).toBeFocused();
        const outline = await target.evaluate((el) =>
          parseFloat(getComputedStyle(el).outlineWidth),
        );
        expect(outline, `anello di focus su «${label}»`).toBeGreaterThan(0);
      }
    });

    test("testo al 200%: nessuno scroll orizzontale da 1440 a 390 px", async ({
      page,
    }) => {
      await open(page, path, h1);
      await page.addStyleTag({
        content: "html { font-size: 200% !important; }",
      });
      for (const width of WIDTHS) {
        await page.setViewportSize({ width, height: 900 });
        const { scrollWidth, clientWidth } = await page.evaluate(() => ({
          scrollWidth: document.documentElement.scrollWidth,
          clientWidth: document.documentElement.clientWidth,
        }));
        expect(
          scrollWidth,
          `scroll orizzontale a ${width}px`,
        ).toBeLessThanOrEqual(clientWidth);
        for (const label of actions) {
          await expect(action(page, label)).toBeVisible();
        }
      }
      await expectNoA11yViolations(page);
    });

    test("con riduzione del movimento nulla si anima", async ({ page }) => {
      await page.emulateMedia({ reducedMotion: "reduce" });
      await open(page, path, h1);
      const running = await page
        .getByRole("main")
        .evaluate((main) => main.getAnimations({ subtree: true }).length);
      expect(running).toBe(0);
      // The flaps are decoration: the code is read from the text, not digit by digit.
      await expect(
        page.getByRole("main").locator("[data-slot=flip-digits]"),
      ).toHaveCount(1);
      expect(
        await page
          .getByRole("main")
          .locator("[data-slot=flip-digits]")
          .evaluate((el) => !!el.closest('[aria-hidden="true"]')),
      ).toBe(true);
    });
  });
}

test("404: «Vai alle tappe» porta alle tappe", async ({ page }) => {
  await open(page, "/questa-rotta-non-esiste", "Pagina non trovata");
  await expect(page.getByText("Rientra dalle tappe")).toBeVisible();
  await expectNoA11yViolations(page);
  await action(page, "Vai alle tappe").click();
  await expect(page).toHaveURL(/\/tappe$/);
  await expect(
    page.getByRole("heading", { level: 1, name: "Tappe" }),
  ).toBeVisible();
});

test("403: mini tabellone dei ruoli", async ({ page }) => {
  await open(page, "/admin/anteprima/403", "Accesso negato");
  const board = page.getByRole("main").locator("dl");
  await expect(board).toContainText("Il tuo ruolo");
  await expect(board).toContainText("Giocatore");
  await expect(board).toContainText("Richiesto");
  await expect(board).toContainText("Admin");
  // A player who is refused does not get the admin navigation.
  await expect(page.locator("aside")).toHaveCount(0);
  await expectNoA11yViolations(page);
});

test("503: Riprova, Torna al modulo e Home sulla stessa riga", async ({
  page,
}) => {
  test.skip((page.viewportSize()?.width ?? 0) < 768, "riga intera da tablet");
  await open(page, "/anteprima/503", "Servizio non disponibile");
  const tops = await Promise.all(
    ["Riprova", "Torna al modulo", "Home"].map(async (label) =>
      Math.round((await action(page, label).boundingBox())!.y),
    ),
  );
  expect(new Set(tops).size).toBe(1);
  await expect(page.getByRole("main").locator("time")).toBeVisible();
  await expect(page.getByRole("main")).toContainText("ERR-503");
  await expectNoA11yViolations(page);
});
