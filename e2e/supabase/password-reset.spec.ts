import type { Locator, Page } from "@playwright/test";
import { expect, expectNoA11yViolations, test } from "../fixtures";
import { getLatestLink, isMailpitAvailable } from "../mailpit";
import {
  adminClient,
  anonClient,
  isSupabaseLocalConfigured,
  uniqueAddress,
} from "./env";

/**
 * BLVS-14 end to end: Next.js on the local Supabase stack, the reset email
 * read from Mailpit, every step done with the keyboard.
 */

const OLD_PASSWORD = "Vecchia-password-1";
const NEW_PASSWORD = "Nuova-password-2026";

test.beforeAll(async () => {
  const ready = isSupabaseLocalConfigured() && (await isMailpitAvailable());
  if (process.env.CI) {
    expect(ready, "Supabase locale e Mailpit raggiungibili").toBe(true);
  }
  test.skip(!ready, "Serve Supabase locale (supabase start) con Mailpit");
});

test.use({ reducedMotion: "reduce" });

async function tabTo(page: Page, target: Locator) {
  for (let i = 0; i < 15; i++) {
    await page.keyboard.press("Tab");
    if (await target.evaluate((el) => el === document.activeElement)) return;
  }
  throw new Error("Elemento non raggiunto con Tab");
}

test("flusso completo da tastiera con il link letto da Mailpit", async ({
  page,
  baseURL,
}) => {
  const email = uniqueAddress("reimposta");
  const { error: createError } = await adminClient().auth.admin.createUser({
    email,
    password: OLD_PASSWORD,
    email_confirm: true,
  });
  expect(createError).toBeNull();

  // The "other device": a session opened before the reset.
  const other = anonClient();
  const { data: signedIn, error: signInError } =
    await other.auth.signInWithPassword({ email, password: OLD_PASSWORD });
  expect(signInError).toBeNull();
  const otherRefreshToken = signedIn.session!.refresh_token;

  // w-forgot
  const since = new Date();
  await page.goto("/password-dimenticata");
  await page.waitForLoadState("networkidle");
  await expectNoA11yViolations(page);
  await tabTo(page, page.getByRole("textbox", { name: /Email/ }));
  await page.keyboard.type(email);
  await page.keyboard.press("Enter");

  // w-forgot-sent
  await expect(
    page.getByRole("heading", { level: 1, name: "Controlla la tua email" }),
  ).toBeFocused();
  await expectNoA11yViolations(page);

  // The link points at our page with the token hash, on Supabase's site_url.
  const link = new URL(
    await getLatestLink(email, { after: since, match: /reimposta-password/ }),
  );
  expect(link.pathname).toBe("/reimposta-password");
  expect(link.searchParams.get("token_hash")).toBeTruthy();
  const resetUrl = `${baseURL}${link.pathname}${link.search}`;

  // w-reset
  await page.goto(resetUrl);
  const password = page.getByLabel(/^Nuova password/);
  await expect(password).toBeVisible();
  await page.waitForLoadState("networkidle");
  await expectNoA11yViolations(page);
  await tabTo(page, password);
  await page.keyboard.type(NEW_PASSWORD);
  await page.keyboard.press("Tab");
  await page.keyboard.type(NEW_PASSWORD);
  await page.keyboard.press("Enter");

  await expect(page).toHaveURL(`${baseURL}/`);
  await expect(
    page.locator("[data-slot=toast-description]", {
      hasText: "Abbiamo chiuso le sessioni aperte",
    }),
  ).toBeVisible();

  // The other session is closed, the old password no longer works.
  const { error: refreshError } = await anonClient().auth.refreshSession({
    refresh_token: otherRefreshToken,
  });
  expect(refreshError).not.toBeNull();
  const { error: oldError } = await anonClient().auth.signInWithPassword({
    email,
    password: OLD_PASSWORD,
  });
  expect(oldError).not.toBeNull();
  const { error: newError } = await anonClient().auth.signInWithPassword({
    email,
    password: NEW_PASSWORD,
  });
  expect(newError).toBeNull();

  // The same link a second time: already used.
  await page.goto(resetUrl);
  await expect(password).toBeVisible();
  await page.waitForLoadState("networkidle");
  await password.fill("Terza-password-2026");
  await page
    .getByLabel(/^Ripeti la nuova password/)
    .fill("Terza-password-2026");
  await page.keyboard.press("Enter");
  await expect(
    page.getByRole("heading", { level: 1, name: "Link scaduto o già usato" }),
  ).toBeFocused();
  await expectNoA11yViolations(page);
});

test("la richiesta risponde uguale per un'email inesistente", async ({
  request,
}) => {
  const answers = await Promise.all(
    [uniqueAddress("inesistente"), uniqueAddress("inesistente")].map(
      async (email) => {
        const res = await request.post("/api/auth/password/richiesta", {
          data: { email },
        });
        return { status: res.status(), body: await res.text() };
      },
    ),
  );
  expect(answers[0].status).toBe(202);
  expect(answers[1]).toEqual(answers[0]);
});
