import type { Page } from "@playwright/test";
import { expect, expectNoA11yViolations, test } from "./fixtures";

/**
 * w-login and w-sessione-scaduta. e2e runs without Supabase, so a valid
 * attempt ends in «non disponibile»; what matters here is the form itself:
 * a11y, keyboard, focus on errors, the attempt limit and 200 % text.
 */

// Each test gets its own client IP: the login limit counts per IP too, and
// the server is shared by both projects (and reused across runs).
test.beforeEach(async ({ page }) => {
  const octet = () => Math.floor(Math.random() * 254) + 1;
  await page.setExtraHTTPHeaders({
    "x-forwarded-for": `10.${octet()}.${octet()}.${octet()}`,
  });
});

const uniqueEmail = () =>
  `prova.${Math.random().toString(36).slice(2, 10)}@esempio.it`;

async function expectNoHorizontalScroll(page: Page) {
  const { scrollWidth, clientWidth } = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  expect(scrollWidth).toBeLessThanOrEqual(clientWidth);
}

async function openLogin(page: Page, query = "") {
  await page.goto(`/accesso${query}`);
  await expect(
    page.getByRole("heading", { level: 1, name: "Accedi" }),
  ).toBeVisible();
  // Hydrated: the form is the client one, wired to the server action.
  await page.waitForLoadState("networkidle");
}

test.describe("accesso", () => {
  test.use({ reducedMotion: "reduce" });

  test("rispetta WCAG 2.2 AA e usa i suggerimenti dei gestori di password", async ({
    page,
  }) => {
    await openLogin(page);
    await expect(page).toHaveTitle("Accedi · BLVS");
    const banner = page.getByRole("banner");
    await expect(banner.locator("a, button")).toHaveCount(0);
    await expect(page.getByLabel(/^Email/)).toHaveAttribute(
      "autocomplete",
      "username",
    );
    await expect(page.getByLabel(/^Password/)).toHaveAttribute(
      "autocomplete",
      "current-password",
    );
    await expectNoA11yViolations(page);
  });

  test("si compila da tastiera, incolla compreso", async ({ page }) => {
    await openLogin(page);
    await page.keyboard.press("Tab");
    await expect(
      page.getByRole("link", { name: "Vai al contenuto" }),
    ).toBeFocused();
    await page.keyboard.press("Tab");
    const email = page.getByLabel(/^Email/);
    await expect(email).toBeFocused();
    await page.keyboard.type("mario@esempio.it");
    await page.keyboard.press("Tab");
    const password = page.getByLabel(/^Password/);
    await expect(password).toBeFocused();

    // Paste works (password managers, copied passwords).
    await page.evaluate(() => {
      const data = new DataTransfer();
      data.setData("text/plain", "Incollata-123");
      const target = document.activeElement as HTMLInputElement;
      const allowed = target.dispatchEvent(
        new ClipboardEvent("paste", {
          clipboardData: data,
          bubbles: true,
          cancelable: true,
        }),
      );
      if (allowed) target.value = "Incollata-123";
    });
    await expect(password).toHaveValue("Incollata-123");

    await page.keyboard.press("Tab");
    const toggle = page.getByRole("button", { name: "Mostra password" });
    await expect(toggle).toBeFocused();
    await page.keyboard.press("Space");
    await expect(toggle).toHaveAttribute("aria-pressed", "true");
    await expect(password).toHaveAttribute("type", "text");
    await page.keyboard.press("Tab");
    await expect(page.getByRole("button", { name: "Accedi" })).toBeFocused();
  });

  test("con i campi vuoti il focus va sul primo errore", async ({ page }) => {
    await openLogin(page);
    await page.getByRole("button", { name: "Accedi" }).click();
    const email = page.getByLabel(/^Email/);
    await expect(email).toHaveAttribute("aria-invalid", "true");
    await expect(email).toBeFocused();
    await expect(page.getByLabel(/^Password/)).toHaveAttribute(
      "aria-invalid",
      "true",
    );
    await expectNoA11yViolations(page);
  });

  test("un errore del modulo riceve il focus e conserva l'email", async ({
    page,
  }) => {
    await openLogin(page);
    const address = uniqueEmail();
    await page.getByLabel(/^Email/).fill(address);
    await page.getByLabel(/^Password/).fill("una-password");
    await page.getByRole("button", { name: "Accedi" }).click();
    const error = page.locator("[data-slot=login-error]");
    await expect(error).toBeFocused();
    await expect(page.getByLabel(/^Email/)).toHaveValue(address);
    await expect(page.getByLabel(/^Password/)).toHaveValue("");
    await expectNoA11yViolations(page);
  });

  test("dopo tentativi ripetuti l'accesso è sospeso con il tempo di attesa scritto", async ({
    page,
  }) => {
    await openLogin(page);
    const address = uniqueEmail();
    const error = page.locator("[data-slot=login-error]");
    for (let i = 0; i < 6; i++) {
      await page.getByLabel(/^Email/).fill(address);
      await page.getByLabel(/^Password/).fill(`tentativo-${i}`);
      await page.getByRole("button", { name: "Accedi" }).click();
      await expect(error).toBeFocused();
      if (i < 5)
        await expect(error).not.toHaveAttribute("data-status", "rateLimited");
    }
    await expect(error).toHaveAttribute("data-status", "rateLimited");
    await expect(error).toContainText(
      /Accesso sospeso per troppi tentativi non riusciti\. Riprova tra 15 minuti, dalle \d{2}:\d{2}\./,
    );
    await expect(
      page.getByText(
        "Il pulsante si riattiva da solo allo scadere dell'attesa.",
      ),
    ).toBeVisible();
    await expectNoA11yViolations(page);
  });

  test("dopo «Esci» e a sessione scaduta mostra il messaggio giusto", async ({
    page,
  }) => {
    await openLogin(page, "?uscita=1");
    await expect(page.getByText("Sei uscito dall'account.")).toBeVisible();
    await expectNoA11yViolations(page);

    await openLogin(page, "?da=%2Fclassifica&motivo=scaduta");
    await expect(page.getByText("La sessione è scaduta.")).toBeVisible();
    await expect(
      page.locator("[data-slot=login-notice]").getByText("Classifica"),
    ).toBeVisible();
    await expect(page.locator("input[name=da]")).toHaveValue("/classifica");
    await expectNoA11yViolations(page);
  });

  test("con il testo al 200% non scorre in orizzontale", async ({ page }) => {
    await openLogin(page, "?da=%2Fadmin%2Ftappe&motivo=scaduta");
    await page.addStyleTag({ content: "html { font-size: 200% !important; }" });
    await page.getByRole("button", { name: "Accedi" }).click();
    await expect(page.getByLabel(/^Email/)).toBeFocused();
    await expectNoHorizontalScroll(page);
    await expectNoA11yViolations(page);
  });
});

test.describe("sessione scaduta", () => {
  test.use({ reducedMotion: "reduce" });

  test("dice dove si torna, cosa è salvato e cosa resta in bozza", async ({
    page,
  }) => {
    await page.addInitScript(() => {
      localStorage.setItem(
        "blvs:bozza:iscrizione-rimini",
        JSON.stringify({
          id: "iscrizione-rimini",
          label: "Iscrizione alla tappa di Rimini",
          path: "/tappe",
          savedAt: "2026-10-27T09:42:00.000Z",
          values: { nome: "Mario" },
        }),
      );
    });
    await page.goto("/sessione-scaduta?da=%2Fadmin%2Ftappe");
    await expect(page).toHaveTitle("Sessione scaduta · BLVS");
    await expect(
      page.getByRole("heading", { name: "Dove torni" }),
    ).toBeVisible();
    await expect(page.getByText("Admin · Tappe")).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Cosa è salvato" }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Iscrizione alla tappa di Rimini" }),
    ).toHaveAttribute("href", "/tappe");
    const login = page.getByRole("link", { name: "Accedi di nuovo" });
    await expect(login).toHaveAttribute(
      "href",
      "/accesso?da=%2Fadmin%2Ftappe&motivo=scaduta",
    );
    await expectNoA11yViolations(page);

    await page.waitForLoadState("networkidle");
    await login.click();
    await expect(page).toHaveURL("/accesso?da=%2Fadmin%2Ftappe&motivo=scaduta");
    await expect(page.locator("input[name=da]")).toHaveValue("/admin/tappe");
  });

  test("accetta solo percorsi interni per il ritorno", async ({ page }) => {
    await page.goto("/sessione-scaduta?da=%2F%2Fevil.example");
    await expect(
      page.getByRole("link", { name: "Accedi di nuovo" }),
    ).toHaveAttribute("href", "/accesso?motivo=scaduta");
    await expect(
      page.getByText(/Nessuna bozza su questo dispositivo/),
    ).toBeVisible();
    await expectNoA11yViolations(page);
  });

  test("con il testo al 200% non scorre in orizzontale", async ({ page }) => {
    await page.goto("/sessione-scaduta?da=%2Fclassifica");
    await page.addStyleTag({ content: "html { font-size: 200% !important; }" });
    await expect(
      page.getByRole("heading", { name: "Dove torni" }),
    ).toBeVisible();
    await expectNoHorizontalScroll(page);
    await expectNoA11yViolations(page);
  });
});
