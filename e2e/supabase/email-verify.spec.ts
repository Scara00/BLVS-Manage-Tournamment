import { expect, test } from "@playwright/test";
import { expectNoA11yViolations } from "../fixtures";
import { getLatestLink, isMailpitAvailable } from "../mailpit";
import { adminClient, isSupabaseLocalConfigured, uniqueAddress } from "./env";

/**
 * BLVS-15 end to end, with Next.js on local Supabase and Mailpit
 * (playwright.supabase.config.ts starts the app): register, confirm from the
 * keyboard with the link caught by Mailpit, and check that a resend
 * invalidates the previous link and that only a confirmed player can sign
 * up to a stage.
 */
const PATH = "/registrati/conferma-email";
const LINK = /\/registrati\/conferma-email\/verifica\?/;

test.beforeAll(async () => {
  const ready = isSupabaseLocalConfigured() && (await isMailpitAvailable());
  if (process.env.CI) {
    expect(ready, "Supabase locale e Mailpit raggiungibili").toBe(true);
  }
  test.skip(!ready, "Serve Supabase locale (supabase start) con Mailpit");
});

/** The email link points at site_url: open it on the app under test. */
function onApp(link: string, baseURL: string) {
  const url = new URL(link);
  return new URL(`${url.pathname}${url.search}`, baseURL).toString();
}

async function openStage() {
  const { data, error } = await adminClient()
    .from("tappe")
    .insert({
      nome: `Tappa e2e ${crypto.randomUUID().slice(0, 6)}`,
      luogo: "Spiaggia",
      data_inizio: "2027-06-01",
      data_fine: "2027-06-02",
      stato: "iscrizioni_aperte",
    })
    .select("id")
    .single<{ id: string }>();
  expect(error).toBeNull();
  return data!.id;
}

test("registrazione → conferma da tastiera con il link da Mailpit", async ({
  page,
  baseURL,
}) => {
  // Two emails at least 60 s apart (max_frequency): give it room.
  test.setTimeout(180_000);
  const email = uniqueAddress("verifica");
  const tappa = await openStage();

  const since = new Date();
  const registered = await page.request.post("/api/auth/register", {
    data: {
      email,
      password: "Password-di-prova-1",
      nome: "Giulia",
      cognome: "Rossi",
      categoria: "F",
      consensoPrivacy: true,
    },
  });
  expect(registered.ok()).toBe(true);
  const firstLink = await getLatestLink(email, { after: since, match: LINK });

  // Without confirmation there is no session: the sign-up is refused.
  const refused = await page.request.post("/api/iscrizioni", {
    data: { tappaId: tappa },
  });
  expect(refused.status()).toBe(403);

  await page.goto(PATH);
  await expect(
    page.getByRole("heading", { level: 1, name: "Controlla la tua email" }),
  ).toBeVisible();
  await expect(page.getByText(email).first()).toBeVisible();
  await expectNoA11yViolations(page);

  // Keyboard only: reach «Reinvia», locked for 60 s, then send again.
  await page.waitForLoadState("networkidle");
  await page.locator("main").focus();
  await page.keyboard.press("Tab");
  const resend = page.getByRole("button", { name: "Reinvia email" });
  await expect(resend).toBeFocused();
  await expect(resend).toHaveAttribute("aria-disabled", "true");
  await expect(resend).not.toHaveAttribute("aria-disabled", "true", {
    timeout: 75_000,
  });
  await expect(resend).toBeFocused();
  const resentAt = new Date();
  await page.keyboard.press("Enter");
  await expect(
    page.getByText("Ti abbiamo inviato un nuovo link."),
  ).toBeVisible();
  const secondLink = await getLatestLink(email, {
    after: resentAt,
    match: LINK,
  });
  expect(secondLink).not.toBe(firstLink);

  // The previous link no longer works.
  await page.goto(onApp(firstLink, baseURL!));
  await expect(
    page.getByRole("heading", { level: 1, name: "Link scaduto o già usato" }),
  ).toBeVisible();
  await expectNoA11yViolations(page);

  // The new one confirms and signs the player in.
  await page.goto(onApp(secondLink, baseURL!));
  await expect(
    page.getByRole("heading", { level: 1, name: "Email confermata" }),
  ).toBeVisible();
  await expectNoA11yViolations(page);

  // Used once: opening it again shows the expired state.
  await page.goto(onApp(secondLink, baseURL!));
  await expect(
    page.getByRole("heading", { level: 1, name: "Link scaduto o già usato" }),
  ).toBeVisible();

  const accepted = await page.request.post("/api/iscrizioni", {
    data: { tappaId: tappa },
  });
  expect(accepted.status()).toBe(201);
});
