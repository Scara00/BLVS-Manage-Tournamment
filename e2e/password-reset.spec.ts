import type { Page } from "@playwright/test";
import { expect, expectNoA11yViolations, test } from "./fixtures";

/**
 * w-forgot, w-forgot-sent, w-reset without Supabase: the two API routes are
 * answered by `page.route`. The real flow with the email read from Mailpit
 * is in e2e/supabase/password-reset.spec.ts.
 */

const NEW_PASSWORD = "Spiaggia-2026";

async function tabTo(page: Page, target: ReturnType<Page["locator"]>) {
  for (let i = 0; i < 15; i++) {
    await page.keyboard.press("Tab");
    if (await target.evaluate((el) => el === document.activeElement)) return;
  }
  throw new Error("Elemento non raggiunto con Tab");
}

test.describe("reimpostazione della password", () => {
  test.use({ reducedMotion: "reduce" });

  test("w-forgot → w-forgot-sent solo da tastiera, axe su entrambe", async ({
    page,
  }) => {
    let body: unknown;
    await page.route("**/api/auth/password/richiesta", async (route) => {
      body = route.request().postDataJSON();
      await route.fulfill({
        status: 202,
        json: { messaggio: "Se l'indirizzo è registrato…" },
      });
    });

    await page.goto("/password-dimenticata");
    await expect(page).toHaveTitle("Password dimenticata · BLVS");
    await page.waitForLoadState("networkidle");
    await expectNoA11yViolations(page);

    const email = page.getByRole("textbox", { name: /Email/ });
    await expect(email).toHaveAttribute("autocomplete", "email");

    // Empty submit: the error takes the focus.
    await tabTo(page, page.getByRole("button", { name: "Invia il link" }));
    await page.keyboard.press("Enter");
    await expect(email).toBeFocused();
    await expect(email).toHaveAttribute("aria-invalid", "true");
    await expectNoA11yViolations(page);

    await page.keyboard.type("giocatore@example.it");
    await page.keyboard.press("Enter");

    const heading = page.getByRole("heading", {
      level: 1,
      name: "Controlla la tua email",
    });
    await expect(heading).toBeFocused();
    expect(body).toEqual({ email: "giocatore@example.it" });
    const resend = page.getByRole("button", { name: "Invia di nuovo" });
    await expect(resend).toHaveAttribute("aria-disabled", "true");
    await expect(
      page.getByText(/Puoi chiedere un nuovo invio tra 0:5\d/),
    ).toBeVisible();
    await expectNoA11yViolations(page);
  });

  test("offline: il modulo non invia e lo dice", async ({ page, context }) => {
    await page.goto("/password-dimenticata");
    await page.waitForLoadState("networkidle");
    await context.setOffline(true);
    await page.getByRole("textbox", { name: /Email/ }).fill("a@example.it");
    await page.getByRole("button", { name: "Invia il link" }).click();
    await expect(page.getByText(/Sei offline/)).toBeVisible();
    await expectNoA11yViolations(page);
    await context.setOffline(false);
  });

  test("w-reset da tastiera: requisiti a testo, salvataggio e ritorno alla home", async ({
    page,
  }) => {
    let body: unknown;
    await page.route("**/api/auth/password/reimposta", async (route) => {
      body = route.request().postDataJSON();
      await route.fulfill({
        status: 200,
        json: {
          messaggio:
            "Password aggiornata. Abbiamo chiuso le sessioni aperte sugli altri dispositivi.",
          altreSessioniChiuse: true,
        },
      });
    });

    await page.goto("/reimposta-password?token_hash=hash-di-prova");
    await expect(page).toHaveTitle("Nuova password · BLVS");
    const password = page.getByLabel(/^Nuova password/);
    await expect(password).toBeVisible();
    await page.waitForLoadState("networkidle");
    await expectNoA11yViolations(page);
    await expect(password).toHaveAttribute("autocomplete", "new-password");
    await expect(
      page.getByRole("listitem").filter({ hasText: "Almeno un numero" }),
    ).toContainText("manca");
    await expect(
      page.getByText(/chiudiamo le sessioni aperte sugli altri dispositivi/),
    ).toBeVisible();

    await tabTo(page, password);
    await page.keyboard.type(NEW_PASSWORD);
    await page.keyboard.press("Tab");
    await page.keyboard.type(NEW_PASSWORD);
    await expect(
      page.getByRole("listitem").filter({ hasText: "Almeno un numero" }),
    ).toContainText("fatto");
    await expectNoA11yViolations(page);
    await page.keyboard.press("Enter");

    await expect(page).toHaveURL("/");
    await expect(
      page.locator("[data-slot=toast-description]", {
        hasText: "Abbiamo chiuso le sessioni aperte",
      }),
    ).toBeVisible();
    expect(body).toEqual({
      tokenHash: "hash-di-prova",
      password: NEW_PASSWORD,
      conferma: NEW_PASSWORD,
    });
  });

  test("link scaduto o già usato: stato dedicato e richiesta di un nuovo link", async ({
    page,
  }) => {
    await page.route("**/api/auth/password/reimposta", (route) =>
      route.fulfill({
        status: 410,
        json: {
          error: "Il link è scaduto o è già stato usato. Chiedine uno nuovo.",
          stato: "link-non-valido",
        },
      }),
    );
    await page.goto("/reimposta-password?token_hash=usato");
    await page.waitForLoadState("networkidle");
    await page.getByLabel(/^Nuova password/).fill(NEW_PASSWORD);
    await page.getByLabel(/^Ripeti la nuova password/).fill(NEW_PASSWORD);
    await page.keyboard.press("Enter");

    const heading = page.getByRole("heading", {
      level: 1,
      name: "Link scaduto o già usato",
    });
    await expect(heading).toBeFocused();
    await expectNoA11yViolations(page);

    await page.keyboard.press("Tab");
    await expect(
      page.getByRole("link", { name: "Chiedi un nuovo link" }),
    ).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL("/password-dimenticata?motivo=link-scaduto");
    await expect(
      page.getByText(/Il link che hai aperto è scaduto o è già stato usato/),
    ).toBeVisible();
    await expectNoA11yViolations(page);
  });

  test("senza token la pagina mostra subito il link non valido", async ({
    page,
  }) => {
    await page.goto("/reimposta-password");
    await expect(
      page.getByRole("heading", { level: 1, name: "Link scaduto o già usato" }),
    ).toBeVisible();
    await expectNoA11yViolations(page);
  });
});
