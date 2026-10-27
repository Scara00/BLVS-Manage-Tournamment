import type { Page, Route } from "@playwright/test";
import { expect, expectNoA11yViolations, test } from "./fixtures";

// The e2e server has no Supabase: the API is answered here, like it would
// answer for real (see src/app/api/auth/register/route.ts).
const ENDPOINT = "**/api/auth/register";

const EMAIL_TAKEN = "Questa email è già registrata.";

function fulfill(route: Route, status: number, body: unknown) {
  return route.fulfill({
    status,
    contentType: "application/json",
    body: JSON.stringify(body),
  });
}

const field = (page: Page, name: string) =>
  page.getByRole("textbox", { name: new RegExp(`^${name}`) });
const password = (page: Page) => page.getByLabel(/^Password/);
const consent = (page: Page) =>
  page.getByRole("checkbox", { name: /Ho letto/ });
const submit = (page: Page) =>
  page.getByRole("button", { name: /Crea account|Riprova/ });

async function open(page: Page, url = "/registrati") {
  await page.goto(url);
  await page.waitForLoadState("networkidle");
  await expect(
    page.getByRole("heading", { level: 1, name: "Registrati" }),
  ).toBeVisible();
}

async function fill(page: Page) {
  await field(page, "Nome").fill("Giulia");
  await field(page, "Cognome").fill("Colombo");
  await field(page, "Email").fill("giulia@example.it");
  await password(page).fill("una-password-lunga");
  await page.getByRole("radio", { name: "Femminile" }).click();
  await consent(page).click();
}

test.describe("registrazione", () => {
  test.use({ reducedMotion: "reduce" });

  test("rispetta WCAG 2.2 AA e mostra l'anteprima del tabellone", async ({
    page,
  }) => {
    await open(page);
    await expect(page).toHaveTitle("Registrati · BLVS");
    await expect(consent(page)).toHaveAttribute("aria-checked", "false");
    await expectNoA11yViolations(page);

    await field(page, "Cognome").fill("Colombo");
    await field(page, "Nome").fill("giulia");
    const row = page.getByTestId("signup-board-name");
    await expect(row).toHaveText("COLOMBO G.");
    await expect(
      page.locator("[data-slot=signup-board-preview]"),
    ).toHaveAttribute("aria-hidden", "true");
  });

  test("si compila tutto da tastiera e l'utente resta connesso", async ({
    page,
  }) => {
    let body: unknown;
    await page.route(ENDPOINT, (route) => {
      body = route.request().postDataJSON();
      return fulfill(route, 201, { messaggio: "ok", connesso: true });
    });
    await open(page, "/registrati?da=%2Ftappe");

    await field(page, "Nome").focus();
    await page.keyboard.type("Giulia");
    await page.keyboard.press("Tab");
    await expect(field(page, "Cognome")).toBeFocused();
    await page.keyboard.type("Colombo");
    await page.keyboard.press("Tab");
    await page.keyboard.type("giulia@example.it");
    await page.keyboard.press("Tab");
    await expect(password(page)).toBeFocused();
    // Incolla ammesso: nessuno annulla l'evento paste.
    const pasteBlocked = await page.evaluate(() => {
      const event = new ClipboardEvent("paste", {
        bubbles: true,
        cancelable: true,
      });
      document.activeElement!.dispatchEvent(event);
      return event.defaultPrevented;
    });
    expect(pasteBlocked).toBe(false);
    await page.keyboard.type("una-password-lunga");
    await page.keyboard.press("Tab");
    await expect(page.getByRole("radio", { name: "Maschile" })).toBeFocused();
    await page.keyboard.press("ArrowDown");
    await expect(page.getByRole("radio", { name: "Femminile" })).toBeChecked();
    await page.keyboard.press("Tab");
    await expect(
      page.getByRole("link", { name: "informativa privacy" }),
    ).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(consent(page)).toBeFocused();
    await page.keyboard.press("Space");
    await expect(consent(page)).toHaveAttribute("aria-checked", "true");
    await page.keyboard.press("Tab");
    await expect(submit(page)).toBeFocused();
    await expectNoA11yViolations(page);
    await page.keyboard.press("Enter");

    await expect(page).toHaveURL("/tappe");
    expect(body).toEqual({
      nome: "Giulia",
      cognome: "Colombo",
      email: "giulia@example.it",
      password: "una-password-lunga",
      categoria: "F",
      consensoPrivacy: true,
    });
  });

  test("gli errori sono accanto ai campi, annunciati e col focus sul primo", async ({
    page,
  }) => {
    let calls = 0;
    await page.route(ENDPOINT, (route) => {
      calls++;
      return fulfill(route, 500, {});
    });
    await open(page);
    await field(page, "Nome").fill("Giulia");
    await submit(page).click();

    const cognome = field(page, "Cognome");
    await expect(cognome).toBeFocused();
    await expect(cognome).toHaveAttribute("aria-invalid", "true");
    await expect(cognome).toHaveAccessibleDescription(
      /Errore: Campo obbligatorio/,
    );
    await expect(consent(page)).toHaveAccessibleDescription(
      /devi accettare l'informativa privacy/,
    );
    await expect(
      page.getByRole("radiogroup", { name: /Categoria/ }),
    ).toHaveAccessibleDescription(/Scegli la categoria/);
    expect(calls).toBe(0);
    await expectNoA11yViolations(page);
  });

  test("email già registrata: messaggio accanto al campo con «Accedi»", async ({
    page,
  }) => {
    await page.route(ENDPOINT, (route) =>
      fulfill(route, 409, {
        error: EMAIL_TAKEN,
        fields: { email: EMAIL_TAKEN },
      }),
    );
    await open(page);
    await fill(page);
    await field(page, "Email").fill("Giulia@Example.IT");
    await submit(page).click();

    const email = field(page, "Email");
    await expect(email).toBeFocused();
    await expect(email).toHaveAccessibleDescription(new RegExp(EMAIL_TAKEN));
    const error = page.locator("[data-slot=field-error]", {
      hasText: EMAIL_TAKEN,
    });
    await expect(error.getByRole("link", { name: "Accedi" })).toHaveAttribute(
      "href",
      "/accesso",
    );
    await expect(field(page, "Nome")).toHaveValue("Giulia");
    await expectNoA11yViolations(page);
  });

  test("tornando dall'informativa i dati restano (la password mai salvata)", async ({
    page,
  }) => {
    await open(page);
    await fill(page);
    await page.getByRole("link", { name: "informativa privacy" }).click();
    await expect(page).toHaveURL("/privacy?da=%2Fregistrati");
    await page.waitForLoadState("networkidle");
    await page
      .getByRole("link", { name: "Torna alla pagina precedente" })
      .click();
    await expect(page).toHaveURL("/registrati");

    await expect(field(page, "Nome")).toHaveValue("Giulia");
    await expect(field(page, "Cognome")).toHaveValue("Colombo");
    await expect(field(page, "Email")).toHaveValue("giulia@example.it");
    await expect(page.getByRole("radio", { name: "Femminile" })).toBeChecked();
    await expect(consent(page)).toHaveAttribute("aria-checked", "true");
    // Client navigation keeps the route state (Activity), but the password
    // is never written to storage: after a full reload only the draft is back.
    const stored = await page.evaluate(() => JSON.stringify(sessionStorage));
    expect(stored).toContain("Colombo");
    expect(stored).not.toContain("una-password-lunga");
    await page.reload();
    await page.waitForLoadState("networkidle");
    await expect(field(page, "Nome")).toHaveValue("Giulia");
    await expect(field(page, "Email")).toHaveValue("giulia@example.it");
    await expect(page.getByRole("radio", { name: "Femminile" })).toBeChecked();
    await expect(consent(page)).toHaveAttribute("aria-checked", "true");
    await expect(password(page)).toHaveValue("");
    await expectNoA11yViolations(page);
  });

  test("rete assente o offline: avvisa e non perde i dati", async ({
    page,
    context,
  }) => {
    await page.route(ENDPOINT, (route) => route.abort("internetdisconnected"));
    await open(page);
    await fill(page);
    await submit(page).click();
    await expect(page.getByText(/Connessione non riuscita/)).toBeVisible();
    await expect(page.getByRole("button", { name: "Riprova" })).toBeVisible();
    await expect(password(page)).toHaveValue("una-password-lunga");

    await context.setOffline(true);
    await expect(page.getByText(/Sei offline/)).toBeVisible();
    await expect(submit(page)).toHaveAttribute("aria-disabled", "true");
    await expect(field(page, "Email")).toHaveValue("giulia@example.it");
    await expectNoA11yViolations(page);
    await context.setOffline(false);
    await expect(page.getByText(/Sei offline/)).toBeHidden();
  });

  test("con il testo al 200% non scorre in orizzontale", async ({ page }) => {
    await open(page);
    await page.addStyleTag({ content: "html { font-size: 200% !important; }" });
    await field(page, "Cognome").fill(
      "Della Valle Sant'Ambrogio Bartolomei-Castelfranco",
    );
    const { scrollWidth, clientWidth } = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }));
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth);
    await expectNoA11yViolations(page);
  });
});
