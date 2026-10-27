import { expect, test } from "@playwright/test";
import { isMailpitAvailable, waitForLatestEmail } from "../mailpit";
import {
  adminClient,
  isSupabaseLocalConfigured,
  supabaseLocal,
  uniqueAddress,
} from "./env";

/*
 * BLVS-22 end to end on the local stack: an admin cancels a stage from the
 * dashboard, every pending or confirmed player gets «Tappa annullata»
 * through the BLVS-08 queue (verified in Mailpit), the others do not, and
 * the database refuses new registrations.
 */

const PASSWORD = "Password-di-prova-1";

test.beforeAll(async () => {
  const ready = isSupabaseLocalConfigured() && (await isMailpitAvailable());
  if (process.env.CI) {
    expect(ready, "Supabase locale e Mailpit raggiungibili").toBe(true);
  }
  test.skip(!ready, "Serve Supabase locale (supabase start) con Mailpit");
});

async function createUser(prefix: string, ruolo: "admin" | "giocatore") {
  const email = uniqueAddress(prefix);
  const { data, error } = await adminClient().auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
    user_metadata: { nome: "Prova", cognome: prefix, categoria: "M" },
  });
  expect(error).toBeNull();
  if (ruolo === "admin") {
    // No JWT with the secret key: `proteggi_campi_utente` lets it through.
    const { error: roleError } = await adminClient()
      .from("utenti")
      .update({ ruolo: "admin" })
      .eq("id", data.user!.id);
    expect(roleError).toBeNull();
  }
  return { id: data.user!.id, email };
}

test("annullare una tappa avvisa gli iscritti via email e blocca le iscrizioni", async ({
  page,
}) => {
  const admin = adminClient();
  const nome = `Tappa annullabile ${crypto.randomUUID().slice(0, 6)}`;
  const { data: tappa, error } = await admin
    .from("tappe")
    .insert({
      nome,
      luogo: "Spiaggia di prova",
      data_inizio: "2099-07-01",
      data_fine: "2099-07-02",
      stato: "iscrizioni_aperte",
      iscrizioni_chiudono_il: "2099-06-20T21:59:00Z",
    })
    .select("id, tabelloni (id, categoria)")
    .single();
  expect(error).toBeNull();
  const tabellone = tappa!.tabelloni.find(
    (t: { categoria: string }) => t.categoria === "M",
  )!.id;

  const iscritti = [
    await createUser("iscritto", "giocatore"),
    await createUser("confermato", "giocatore"),
  ];
  const ritirato = await createUser("ritirato", "giocatore");
  const { error: iscrizioniError } = await admin.from("iscrizioni").insert([
    { tappa_id: tappa!.id, tabellone_id: tabellone, utente_id: iscritti[0].id },
    {
      tappa_id: tappa!.id,
      tabellone_id: tabellone,
      utente_id: iscritti[1].id,
      stato: "confermata",
    },
    {
      tappa_id: tappa!.id,
      tabellone_id: tabellone,
      utente_id: ritirato.id,
      stato: "ritirata",
    },
  ]);
  expect(iscrizioniError).toBeNull();

  const amministratore = await createUser("admin", "admin");
  // The login limit counts per IP: a fresh one for this test.
  await page.setExtraHTTPHeaders({
    "x-forwarded-for": `10.22.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}`,
  });
  await page.goto("/accesso?da=%2Fadmin");
  await page.getByLabel(/^Email/).fill(amministratore.email);
  await page.getByLabel(/^Password/).fill(PASSWORD);
  await page.getByRole("button", { name: "Accedi" }).click();
  await expect(page).toHaveURL(/\/admin$/);

  const since = new Date();
  await page.getByRole("button", { name: `Annulla tappa: ${nome}` }).click();
  const dialog = page.getByRole("alertdialog", {
    name: `Annullare «${nome}»?`,
  });
  await expect(dialog).toContainText(
    "2 iscritti riceveranno l'avviso via email",
  );
  await dialog
    .getByRole("textbox", { name: /Motivo/ })
    .fill("Allerta meteo: spiaggia chiusa");
  await dialog.getByRole("button", { name: "Annulla tappa" }).click();
  await expect(
    page
      .getByText("Tappa annullata. 2 avvisi sono in partenza.", {
        exact: true,
      })
      .first(),
  ).toBeVisible();

  // The worker runs every minute through pg_cron; run it now.
  const response = await fetch(
    `${supabaseLocal.url}/functions/v1/send-emails`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${supabaseLocal.emailWorkerSecret}` },
    },
  );
  expect(response.status).toBe(200);

  for (const iscritto of iscritti) {
    const message = await waitForLatestEmail(iscritto.email, { after: since });
    expect(message.Subject).toBe(`Tappa annullata: ${nome} · BLVS`);
    expect(message.Text).toContain("Motivo: Allerta meteo: spiaggia chiusa");
  }
  const { data: coda } = await admin
    .from("coda_email")
    .select("destinatario")
    .eq("destinatario", ritirato.email);
  expect(coda).toEqual([]);

  const { data: annullata } = await admin
    .from("tappe")
    .select("stato, motivo_annullamento")
    .eq("id", tappa!.id)
    .single();
  expect(annullata).toEqual({
    stato: "annullata",
    motivo_annullamento: "Allerta meteo: spiaggia chiusa",
  });

  const nuovo = await createUser("tardivo", "giocatore");
  const { error: rifiuto } = await admin.from("iscrizioni").insert({
    tappa_id: tappa!.id,
    tabellone_id: tabellone,
    utente_id: nuovo.id,
  });
  expect(rifiuto).toMatchObject({ code: "23514", hint: "tappa_annullata" });
});
