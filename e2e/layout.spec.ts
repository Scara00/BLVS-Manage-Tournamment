import type { Page } from "@playwright/test";
import { expect, expectNoA11yViolations, test } from "./fixtures";

const PAGES = [
  {
    path: "/",
    title: "BLVS – Manage Tournament",
    h1: "BLVS – Manage Tournament",
  },
  { path: "/tappe", title: "Tappe · BLVS", h1: "Tappe" },
  { path: "/classifica", title: "Classifica · BLVS", h1: "Classifica" },
  {
    path: "/admin",
    title: "Dashboard amministrazione · BLVS",
    h1: "Dashboard",
  },
] as const;

const WIDTHS = [1440, 1280, 1024, 768, 600, 390];

async function setTextSize200(page: Page) {
  await page.addStyleTag({ content: "html { font-size: 200% !important; }" });
}

async function expectNoHorizontalScroll(page: Page, label: string) {
  const { scrollWidth, clientWidth } = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  expect(scrollWidth, `scroll orizzontale ${label}`).toBeLessThanOrEqual(
    clientWidth,
  );
}

const isDesktop = (page: Page) => (page.viewportSize()?.width ?? 0) >= 768;

for (const { path, title, h1 } of PAGES) {
  test.describe(`layout ${path}`, () => {
    test("rispetta WCAG 2.2 AA e ha un titolo univoco", async ({ page }) => {
      await page.goto(path);
      await expect(page).toHaveTitle(title);
      await expect(
        page.getByRole("heading", { level: 1, name: h1 }),
      ).toBeVisible();
      await expect(page.getByRole("banner")).toBeVisible();
      await expect(page.getByRole("main")).toBeVisible();
      await expectNoA11yViolations(page);
    });

    test("nessuno scroll orizzontale da 1440 a 390 px, anche con testo al 200%", async ({
      page,
    }) => {
      await page.goto(path);
      for (const zoom of [false, true]) {
        if (zoom) await setTextSize200(page);
        for (const width of WIDTHS) {
          await page.setViewportSize({ width, height: 900 });
          const label = `a ${width}px${zoom ? " con testo 200%" : ""}`;
          await expectNoHorizontalScroll(page, label);
          await expect(
            page.getByRole("heading", { level: 1, name: h1 }),
            `h1 visibile ${label}`,
          ).toBeVisible();
          await expect(
            page.getByRole("link", { name: /^BLVS/ }),
            `marchio visibile ${label}`,
          ).toBeVisible();
        }
      }
      await expectNoA11yViolations(page);
    });
  });
}

test("i titoli delle pagine sono tutti diversi", async ({ page }) => {
  const titles = new Set<string>();
  for (const { path } of PAGES) {
    await page.goto(path);
    titles.add(await page.title());
  }
  expect(titles.size).toBe(PAGES.length);
});

/** Focused element must not sit under the sticky topbar. */
async function expectFocusClearOfTopbar(page: Page) {
  const { top, barBottom, sticky } = await page.evaluate(() => {
    const el = document.activeElement as HTMLElement;
    const bar = document.querySelector("header")!;
    const inBar = bar.contains(el);
    return {
      top: inBar ? Infinity : el.getBoundingClientRect().top,
      barBottom: bar.getBoundingClientRect().bottom,
      sticky: getComputedStyle(bar).position === "sticky",
    };
  });
  if (sticky) expect(top).toBeGreaterThanOrEqual(barBottom - 1);
}

test("giocatore: tour da tastiera completo", async ({ page }) => {
  await page.goto("/classifica");
  await page.waitForLoadState("networkidle");
  await expectNoA11yViolations(page);

  await page.keyboard.press("Tab");
  const skip = page.getByRole("link", { name: "Vai al contenuto" });
  await expect(skip).toBeFocused();
  await expect(skip).toBeVisible();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("main")).toBeFocused();

  // Back to the top: Tab walks the banner in order.
  await page.goto("/classifica");
  await page.waitForLoadState("networkidle");
  await page.keyboard.press("Tab"); // skip link
  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: /^BLVS/ })).toBeFocused();

  const nav = page.getByRole("navigation", { name: "Principale" });
  if (!isDesktop(page)) {
    await page.keyboard.press("Tab");
    const menu = page.getByRole("button", { name: "Menu" });
    await expect(menu).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(menu).toHaveAttribute("aria-expanded", "true");
    await page.keyboard.press("Escape");
    await expect(menu).toHaveAttribute("aria-expanded", "false");
    await expect(menu).toBeFocused();
  }
  for (const name of ["Tappe", "Live", "Classifica"]) {
    await page.keyboard.press("Tab");
    await expect(nav.getByRole("link", { name })).toBeFocused();
  }
  await expect(nav.getByRole("link", { name: "Classifica" })).toHaveAttribute(
    "aria-current",
    "page",
  );
  if (isDesktop(page)) {
    await page.keyboard.press("Tab");
    await expect(page.getByRole("button", { name: "Esci" })).toBeFocused();
  }

  // Walk the rest of the page: focus stays clear of the sticky bar and
  // eventually leaves the document (no keyboard trap).
  let leftDocument = false;
  for (let i = 0; i < 40; i++) {
    await page.keyboard.press("Tab");
    const onBody = await page.evaluate(
      () => !document.activeElement || document.activeElement === document.body,
    );
    if (onBody) {
      leftDocument = true;
      break;
    }
    await expectFocusClearOfTopbar(page);
  }
  expect(leftDocument, "il focus esce dalla pagina: nessuna trappola").toBe(
    true,
  );
});

test("giocatore: il menu mobile si apre da tastiera e si chiude con Esc", async ({
  page,
}) => {
  test.skip(isDesktop(page), "Solo layout mobile");
  await page.goto("/tappe");
  await page.waitForLoadState("networkidle"); // hydrated: the button works
  const menu = page.getByRole("button", { name: "Menu" });
  await menu.focus();
  await page.keyboard.press("Enter");
  const home = page.getByRole("link", { name: "Home", exact: true });
  await expect(home).toBeVisible();
  await expectNoA11yViolations(page);
  // Tab walks the primary row first, then into the panel.
  for (let i = 0; i < 4; i++) await page.keyboard.press("Tab");
  await expect(home).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(menu).toHaveAttribute("aria-expanded", "false");
  await expect(menu).toBeFocused();
  await expect(home).toBeHidden();
});

test("admin: tour da tastiera e voce attiva", async ({ page }) => {
  await page.goto("/admin");
  await page.waitForLoadState("networkidle");
  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("link", { name: "Vai al contenuto" }),
  ).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: /^BLVS/ })).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(page.getByRole("button", { name: "Esci" })).toBeFocused();

  if (!isDesktop(page)) {
    await page.keyboard.press("Tab");
    const menu = page.getByRole("button", { name: "Menu amministrazione" });
    await expect(menu).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(menu).toHaveAttribute("aria-expanded", "true");
  }
  const nav = page.getByRole("navigation", { name: "Amministrazione" });
  for (const name of ["Dashboard", "Tappe", "Iscrizioni", "Giocatori"]) {
    await page.keyboard.press("Tab");
    await expect(nav.getByRole("link", { name })).toBeFocused();
    await expectFocusClearOfTopbar(page);
  }
  await expect(nav.getByRole("link", { name: "Dashboard" })).toHaveAttribute(
    "aria-current",
    "page",
  );
  if (!isDesktop(page)) {
    await page.keyboard.press("Escape");
    await expect(
      page.getByRole("button", { name: "Menu amministrazione" }),
    ).toBeFocused();
  }
  await expectNoA11yViolations(page);
});

test("«Esci» dall'area admin chiude la sessione e torna alla home", async ({
  page,
}) => {
  await page.goto("/admin");
  await page.waitForLoadState("networkidle"); // hydrated: useActionState form
  // Axe before the click: afterwards the pointer still hovers the «Esci» of
  // the next page and catches its colour transition mid-way.
  await expectNoA11yViolations(page);
  await page.getByRole("button", { name: "Esci" }).click();
  await expect(page).toHaveURL("/");
  await expect(page.getByText("Non è stato possibile uscire")).toHaveCount(0);
});
