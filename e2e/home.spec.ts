import type { BrowserContext, Page } from "@playwright/test";
import { expect, expectNoA11yViolations, test } from "./fixtures";
import { waitForAnimations } from "./storybook-helpers";

/*
 * w-home (BLVS-52). The demo player is «Luca Rossi», registered (seat 1)
 * to Jesolo, 14–15 June 2027. The demo-only cookie `blvs_demo_oggi`
 * moves «today» so each view is reachable: the race day, another day, and
 * after the last stage. Never wait for "networkidle" on the race day: SSE
 * keeps a request open.
 */

const OGGI_COOKIE = "blvs_demo_oggi";

async function oggi(context: BrowserContext, baseURL: string, giorno: string) {
  await context.addCookies([
    { name: OGGI_COOKIE, value: giorno, url: baseURL },
  ]);
}

const liveBar = (page: Page) =>
  page.getByRole("region", { name: "Stato degli aggiornamenti" });

test("la home mostra il titolo, la lingua italiana e il saluto", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page).toHaveTitle("BLVS – Manage Tournament");
  await expect(page.locator("html")).toHaveAttribute("lang", "it");
  await expect(
    page.getByRole("heading", { level: 1, name: "Ciao, Luca" }),
  ).toBeVisible();
});

test("il layout monta la regione delle notifiche", async ({ page }) => {
  await page.goto("/");
  // The Toaster from src/components/providers.tsx portals into <body>.
  const region = page.getByRole("region", { name: "Notifiche" });
  await expect(region).toBeAttached();
  await expect(region).toHaveAttribute("aria-live", "polite");
});

test("le risposte non forzano HSTS in locale ma hanno gli header di sicurezza", async ({
  request,
}) => {
  const res = await request.get("/");
  expect(res.headers()["x-content-type-options"]).toBe("nosniff");
  expect(res.headers()["strict-transport-security"]).toBeUndefined();
});

test.describe("il giorno di gara", () => {
  test.beforeEach(async ({ context, baseURL }) => {
    await oggi(context, baseURL!, "2027-06-14");
  });

  test("mostra la mia partita, la posizione e il girone con la riga «Tu»", async ({
    page,
  }) => {
    await page.goto("/");
    await expect(page.getByTestId("home-gara")).toBeVisible();
    await expect(
      page.getByRole("heading", { level: 1, name: "Ciao, Luca" }),
    ).toBeVisible();
    // The compact Live bar sits in the header with the greeting.
    await expect(page.locator("header", { has: liveBar(page) })).toContainText(
      "Ciao, Luca",
    );
    await expect(liveBar(page)).toHaveAttribute("data-compact", "true");
    await expect(liveBar(page)).toHaveAttribute("data-status", "live", {
      timeout: 10_000,
    });

    await expect(page.getByTestId("home-mia-partita")).toContainText(
      "Luca Rossi",
    );
    await expect(page.getByTestId("home-posizione-girone")).toContainText(
      "Girone A",
    );
    await expect(page.getByTestId("home-posizione-generale")).toBeVisible();
    // ResponsiveTable renders a table and cards: check the one shown.
    const mia = page
      .getByTestId("live-mio-girone")
      .locator("[data-mia=true]")
      .filter({ visible: true });
    await expect(mia).toContainText("Tu");
    await expect(
      page.getByRole("link", { name: "Segui il live" }),
    ).toHaveAttribute("href", "/tappe/jesolo/live");
  });

  test("rispetta WCAG 2.2 AA", async ({ page }) => {
    await page.goto("/");
    await expect(liveBar(page)).toHaveAttribute("data-status", "live", {
      timeout: 10_000,
    });
    await waitForAnimations(page);
    await expectNoA11yViolations(page);
  });

  test("con la riduzione del movimento niente palette né animazioni", async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/");
    await expect(liveBar(page)).toHaveAttribute("data-status", "live", {
      timeout: 10_000,
    });
    // No split-flap halves and no running animation (pulse, flash, flap).
    await expect(page.locator("[data-half]")).toHaveCount(0);
    await expect(page.locator(".animate-pulse")).toHaveCount(0);
    expect(
      await page.evaluate(
        () =>
          document
            .getAnimations()
            .filter(
              (a) =>
                a.playState === "running" &&
                a.effect?.getComputedTiming().iterations === Infinity,
            ).length,
      ),
    ).toBe(0);
    await expectNoA11yViolations(page);
  });
});

test.describe("negli altri giorni", () => {
  test("mostra la mia prossima tappa con l'iscrizione a testo", async ({
    page,
    context,
    baseURL,
  }) => {
    await oggi(context, baseURL!, "2027-06-01");
    await page.goto("/");
    const card = page.getByTestId("home-prossima");
    await expect(card).toContainText("La tua prossima tappa");
    await expect(card).toContainText("Tappa 1 · Jesolo");
    await expect(card).toContainText("Sei iscritto · posto 1");
    await expect(liveBar(page)).toHaveCount(0);
    await expectNoA11yViolations(page);
  });

  test("dopo la mia tappa propone la prossima con le iscrizioni", async ({
    page,
    context,
    baseURL,
  }) => {
    await oggi(context, baseURL!, "2027-06-20");
    await page.goto("/");
    const card = page.getByTestId("home-prossima");
    await expect(card).toContainText("Prossima tappa");
    await expect(card).toContainText("Tappa 2 · Rimini");
    await expect(card).toHaveAttribute("data-iscrizione", /aperte|chiuse/);
    await expectNoA11yViolations(page);
  });

  test("dopo l'ultima tappa mostra lo stato vuoto", async ({
    page,
    context,
    baseURL,
  }) => {
    await oggi(context, baseURL!, "2030-01-01");
    await page.goto("/");
    await expect(
      page.getByRole("heading", { name: "Nessuna tappa in programma" }),
    ).toBeVisible();
    await expectNoA11yViolations(page);
  });
});
