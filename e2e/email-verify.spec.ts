import type { BrowserContext, Page } from "@playwright/test";
import { expect, expectNoA11yViolations, test } from "./fixtures";

/**
 * w-email-verify (BLVS-15) without Supabase: the states that depend only on
 * the pending-registration cookie and on `?esito=`. The full flow with the
 * link from Mailpit is e2e/supabase/email-verify.spec.ts (CI job supabase).
 */
const PATH = "/registrati/conferma-email";
const COOKIE = "blvs_conferma_email";

async function setPending(
  context: BrowserContext,
  baseURL: string,
  email: string,
  sentSecondsAgo: number,
) {
  const value = Buffer.from(
    JSON.stringify({
      e: email,
      t: new Date(Date.now() - sentSecondsAgo * 1000).toISOString(),
    }),
  ).toString("base64url");
  await context.addCookies([{ name: COOKIE, value, url: baseURL }]);
}

/** Collects the focused elements while pressing Tab through `main`. */
async function tabStops(page: Page, count: number) {
  const stops: string[] = [];
  await page.locator("main").focus();
  for (let i = 0; i < count; i++) {
    await page.keyboard.press("Tab");
    stops.push(
      await page.evaluate(() => {
        const el = document.activeElement as HTMLElement | null;
        if (!el) return "";
        return `${el.tagName.toLowerCase()}:${(el.getAttribute("aria-label") ?? el.textContent ?? "").trim()}|${el.closest("[data-slot=email-preview]") ? "anteprima" : ""}`;
      }),
    );
  }
  return stops;
}

test.describe("conferma email", () => {
  test.use({ reducedMotion: "reduce" });

  test("in attesa: passo 2 di 3, scadenza in cifre, reinvio bloccato", async ({
    page,
    context,
    baseURL,
  }) => {
    await setPending(context, baseURL!, "giulia@example.it", 5);
    await page.goto(PATH);
    await expect(page).toHaveTitle("Conferma email · BLVS");
    await expect(
      page.getByRole("heading", { level: 1, name: "Controlla la tua email" }),
    ).toBeVisible();
    await expect(page.getByText("Passo 2 di 3")).toBeVisible();
    await expect(page.getByText("60 minuti", { exact: true })).toBeVisible();
    await expect(
      page.getByText(/^\d{2}:\d{2} del \d{2}\/\d{2}\/\d{4}$/),
    ).toBeVisible();

    const resend = page.getByRole("button", { name: "Reinvia email" });
    await expect(resend).toHaveAttribute("aria-disabled", "true");
    await expect(
      page.getByText(/Puoi chiedere un nuovo link tra 0:[0-5]\d\./),
    ).toBeVisible();
    await expect(
      page.getByRole("figure", {
        name: "Anteprima dell'email (non interattiva)",
      }),
    ).toBeVisible();
    await expectNoA11yViolations(page);
  });

  test("da tastiera si arriva a «Reinvia», mai al finto pulsante dell'anteprima", async ({
    page,
    context,
    baseURL,
  }) => {
    await setPending(context, baseURL!, "giulia@example.it", 120);
    await page.goto(PATH);
    await page.waitForLoadState("networkidle");
    const stops = await tabStops(page, 4);
    expect(stops[0]).toMatch(/^button:Reinvia email/);
    expect(stops.every((stop) => !stop.endsWith("anteprima"))).toBe(true);

    // Without Supabase the server answers 503: the error is announced and
    // focus stays on the button.
    await page.locator("main").focus();
    await page.keyboard.press("Tab");
    await page.keyboard.press("Enter");
    await expect(
      page.getByText("Autenticazione non configurata."),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Reinvia email" }),
    ).toBeFocused();
    await expectNoA11yViolations(page);
  });

  test("link scaduto o già usato: nuovo invio, con l'email se non è nota", async ({
    page,
  }) => {
    await page.goto(`${PATH}?esito=scaduto`);
    await expect(
      page.getByRole("heading", { level: 1, name: "Link scaduto o già usato" }),
    ).toBeVisible();
    await expect(page.getByRole("textbox", { name: /Email/ })).toBeVisible();
    await expectNoA11yViolations(page);

    await page.waitForLoadState("networkidle");
    await page.getByRole("button", { name: "Invia un nuovo link" }).click();
    await expect(page.getByRole("textbox", { name: /Email/ })).toBeFocused();
  });

  test("confermata: si passa al passo 3", async ({ page }) => {
    await page.goto(`${PATH}?esito=confermata`);
    await expect(
      page.getByRole("heading", { level: 1, name: "Email confermata" }),
    ).toBeVisible();
    await expect(page.getByText("Passo 3 di 3")).toBeVisible();
    await expectNoA11yViolations(page);
    await expect(
      page.getByRole("link", { name: "Continua: scegli la prima tappa" }),
    ).toHaveAttribute("href", "/tappe");
  });

  test("senza una registrazione da confermare: accesso negato", async ({
    page,
  }) => {
    await page.goto(PATH);
    await expect(
      page.getByRole("heading", { level: 1, name: "Accesso negato" }),
    ).toBeVisible();
    await expect(page.getByRole("link", { name: "Registrati" })).toBeVisible();
    await expectNoA11yViolations(page);
  });

  test("il link senza token porta allo stato scaduto", async ({ page }) => {
    await page.goto(`${PATH}/verifica`);
    await expect(page).toHaveURL(new RegExp(`${PATH}\\?esito=scaduto$`));
    await expectNoA11yViolations(page);
  });
});
