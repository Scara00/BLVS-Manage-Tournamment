import type { Page } from "@playwright/test";
import { expect, expectNoA11yViolations, test } from "./fixtures";

/*
 * w-admin-dashboard with the demo calendar (no Supabase env in e2e): the
 * player 403 is covered by the unit tests of requireAdmin and by the
 * BLVS-10 preview. Never wait for "networkidle": on race day the banner
 * keeps an SSE stream open.
 */

const isDesktop = (page: Page) => (page.viewportSize()?.width ?? 0) >= 768;

const liveBar = (page: Page) =>
  page.getByRole("region", { name: "Stato degli aggiornamenti" });

async function waitForLive(page: Page) {
  await expect(liveBar(page)).toHaveAttribute("data-status", "live", {
    timeout: 15_000,
  });
}

const tappeSection = (page: Page) =>
  page.getByRole("region", { name: "Tappe", exact: true });

/** The rows on screen: table rows on desktop, cards on mobile. */
function rows(page: Page) {
  return isDesktop(page)
    ? tappeSection(page).locator("tbody tr")
    : tappeSection(page).locator("ol > li");
}

test("dashboard: banner, tabella con intestazioni e nessuna violazione axe", async ({
  page,
}) => {
  await page.goto("/admin");
  await waitForLive(page);

  await expect(
    page.getByRole("region", { name: /partit[ae] da inserire/ }),
  ).toBeVisible();

  if (isDesktop(page)) {
    const table = page.getByRole("table", { name: "Tappe del circuito" });
    await expect(table.getByRole("columnheader")).toHaveText([
      "Tappa",
      "Data",
      "Iscrizioni",
      "Maschile",
      "Femminile",
    ]);
    await expect(
      table.getByRole("rowheader", { name: "Tappa 1 · Jesolo" }),
    ).toBeVisible();
  } else {
    await expect(
      page.getByRole("list", { name: "Tappe del circuito" }),
    ).toBeVisible();
  }
  // Drafts are listed in the admin table.
  await expect(rows(page)).toHaveCount(5);
  await expect(tappeSection(page)).toContainText("Tappa 4 · Pescara");
  await expect(tappeSection(page)).toContainText("16 iscritti su 16 posti");

  await expectNoA11yViolations(page);
});

test("filtro per stato: da tastiera, solo le tappe in bozza", async ({
  page,
}) => {
  await page.goto("/admin");
  await waitForLive(page);

  const filtro = page.getByRole("navigation", {
    name: "Filtra le tappe per stato",
  });
  const bozza = filtro.getByRole("link", { name: /^(In )?bozza/i });
  await bozza.focus();
  await page.keyboard.press("Enter");

  await expect(page).toHaveURL(/\/admin\?stato=bozza$/);
  await expect(bozza).toHaveAttribute("aria-current", "true");
  await expect(rows(page)).toHaveCount(1);
  await expect(rows(page)).toContainText("Tappa 4 · Pescara");
  await expect(tappeSection(page).getByRole("status")).toHaveText(
    /^1 di 5 tappe · stato «(In )?bozza»$/i,
  );
  await expectNoA11yViolations(page);
});

test("filtro senza risultati e pagina Tappe admin", async ({ page }) => {
  await page.goto("/admin/tappe?stato=annullata");
  await expect(
    page.getByText("Nessuna tappa nello stato «Annullata»."),
  ).toBeVisible();
  await expectNoA11yViolations(page);

  await page.goto("/admin/tappe");
  await expect(rows(page)).toHaveCount(5);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Tappe");
});

test("le bozze compaiono solo nell'area admin", async ({ page }) => {
  await page.goto("/tappe");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Tappe");
  await expect(page.getByText("Tappa 1 · Jesolo")).toBeVisible();
  await expect(page.getByText("Tappa 4 · Pescara")).toHaveCount(0);
  await expect(page.getByText(/^(In )?bozza$/i)).toHaveCount(0);
});

test("il banner «partite da inserire» si aggiorna in tempo reale", async ({
  page,
  request,
}, testInfo) => {
  // The live bus is shared by the parallel projects: publish from one only.
  test.skip(
    testInfo.project.name !== "desktop-1440",
    "un solo progetto pubblica sul bus condiviso",
  );
  await page.goto("/admin");
  await waitForLive(page);

  const count = 40 + Math.floor(Math.random() * 50);
  const res = await request.post("/api/live/publish", {
    data: {
      type: "pending-scores",
      stage: { id: "jesolo", label: "Tappa 1 · Jesolo", count },
    },
  });
  expect(res.status()).toBe(201);

  const banner = page.getByRole("region", {
    name: `${count} partite da inserire`,
  });
  await expect(banner).toBeVisible({ timeout: 5_000 });
  await expect(banner).toHaveAttribute("data-count", String(count));
  await expectNoA11yViolations(page);
});
