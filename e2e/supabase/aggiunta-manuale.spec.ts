import { expect, test } from "@playwright/test";
import { adminClient, isSupabaseLocalConfigured, uniqueAddress } from "./env";

/*
 * w-admin-aggiungi-manuale end to end on the local stack: the admin adds
 * someone with no account from the dialog, through the server action and
 * `admin_iscrivi_giocatore_manuale()`, on the real `auth.users`.
 */

const PASSWORD = "Password-di-prova-1";

test.beforeAll(async () => {
  const ready = isSupabaseLocalConfigured();
  if (process.env.CI) {
    expect(ready, "Supabase locale raggiungibile").toBe(true);
  }
  test.skip(!ready, "Serve Supabase locale (supabase start)");
});

test("l'admin aggiunge a mano chi non ha un account, fino al massimo", async ({
  page,
}) => {
  const admin = adminClient();
  const { data: tappa, error } = await admin
    .from("tappe")
    .insert({
      nome: `Tappa a mano ${crypto.randomUUID().slice(0, 6)}`,
      luogo: "Spiaggia di prova",
      data_inizio: "2099-07-01",
      data_fine: "2099-07-02",
      stato: "iscrizioni_aperte",
      iscrizioni_chiudono_il: "2099-06-20T21:59:00Z",
    })
    .select("id")
    .single();
  expect(error).toBeNull();
  const { error: postiError } = await admin
    .from("tabelloni")
    .update({ posti: 1 })
    .eq("tappa_id", tappa!.id);
  expect(postiError).toBeNull();

  const email = uniqueAddress("admin");
  const { data: account, error: accountError } =
    await admin.auth.admin.createUser({
      email,
      password: PASSWORD,
      email_confirm: true,
      user_metadata: { nome: "Prova", cognome: "Admin", categoria: "M" },
    });
  expect(accountError).toBeNull();
  // No JWT with the secret key: `proteggi_campi_utente` lets it through.
  const { error: ruoloError } = await admin
    .from("utenti")
    .update({ ruolo: "admin" })
    .eq("id", account.user!.id);
  expect(ruoloError).toBeNull();

  // The login limit counts per IP: a fresh one for this test.
  await page.setExtraHTTPHeaders({
    "x-forwarded-for": `10.23.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}`,
  });
  await page.goto("/accesso?da=%2Fadmin");
  await page.getByLabel(/^Email/).fill(email);
  await page.getByLabel(/^Password/).fill(PASSWORD);
  await page.getByRole("button", { name: "Accedi" }).click();
  await expect(page).toHaveURL(/\/admin$/);

  await page.goto(`/admin/tappe/${tappa!.id}/iscritti`);
  await page.getByRole("button", { name: "Aggiungi a mano" }).click();
  const dialog = page.getByRole("dialog", { name: "Aggiungi a mano" });
  const cognome = `Verdi${crypto.randomUUID().slice(0, 6)}`;
  await dialog.getByRole("textbox", { name: /^Nome/ }).fill("Mario");
  await dialog.getByRole("textbox", { name: /^Cognome/ }).fill(cognome);
  await dialog.getByRole("radio", { name: "Maschile" }).click();
  await dialog.getByRole("button", { name: "Aggiungi" }).click();
  await expect(dialog.getByRole("status")).toHaveText(
    `${cognome} Mario ora ha il posto 1.`,
  );

  const { data: righe, error: righeError } = await admin
    .from("utenti")
    .select("email, categoria, iscrizioni (tappa_id, posto, stato)")
    .eq("cognome", cognome);
  expect(righeError).toBeNull();
  expect(righe).toEqual([
    {
      email: expect.stringMatching(/@manuale\.blvs\.invalid$/),
      categoria: "M",
      iscrizioni: [{ tappa_id: tappa!.id, posto: 1, stato: "confermata" }],
    },
  ]);

  // The board is full: refused, and the second player is not created.
  const rifiutato = `Neri${crypto.randomUUID().slice(0, 6)}`;
  await dialog.getByRole("textbox", { name: /^Nome/ }).fill("Paolo");
  await dialog.getByRole("textbox", { name: /^Cognome/ }).fill(rifiutato);
  await dialog.getByRole("button", { name: "Aggiungi" }).click();
  await expect(dialog.getByRole("alert")).toContainText("Posti esauriti");
  const { count } = await admin
    .from("utenti")
    .select("id", { count: "exact", head: true })
    .eq("cognome", rifiutato);
  expect(count).toBe(0);

  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  const elenco = page.getByTestId("tabellone-M");
  await expect(
    elenco.getByText(`${cognome} Mario`).filter({ visible: true }),
  ).toBeVisible();
  await expect(
    elenco.getByText("Senza account").filter({ visible: true }),
  ).toBeVisible();
  await expect(page.getByText("@manuale.blvs.invalid")).toHaveCount(0);
});
