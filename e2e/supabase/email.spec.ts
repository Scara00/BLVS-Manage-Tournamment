import { expect, test } from "@playwright/test";
import {
  getLatestLink,
  isMailpitAvailable,
  waitForLatestEmail,
} from "../mailpit";
import {
  adminClient,
  anonClient,
  isSupabaseLocalConfigured,
  supabaseLocal,
  uniqueAddress,
} from "./env";

test.beforeAll(async () => {
  const ready = isSupabaseLocalConfigured() && (await isMailpitAvailable());
  // In CI the stack must be up: a silent skip would hide a broken setup.
  if (process.env.CI) {
    expect(ready, "Supabase locale e Mailpit raggiungibili").toBe(true);
  }
  test.skip(!ready, "Serve Supabase locale (supabase start) con Mailpit");
});

test.describe("email di Supabase Auth con i modelli italiani", () => {
  test("conferma email: arriva a Mailpit con il link di verifica", async () => {
    const email = uniqueAddress("conferma");
    const since = new Date();
    const { error: createError } = await adminClient().auth.admin.createUser({
      email,
      password: "Password-di-prova-1",
      email_confirm: false,
    });
    expect(createError).toBeNull();

    const { error } = await anonClient().auth.resend({ type: "signup", email });
    expect(error).toBeNull();

    const message = await waitForLatestEmail(email, { after: since });
    expect(message.Subject).toBe("Conferma il tuo indirizzo email · BLVS");
    expect(message.HTML).toMatch(/<html[^>]*\slang="it"/);

    // BLVS-15: the link goes to our route handler, which calls verifyOtp.
    const link = await getLatestLink(email, {
      match: /\/registrati\/conferma-email\/verifica\?/,
    });
    expect(new URL(link).searchParams.get("type")).toBe("email");
    expect(new URL(link).searchParams.get("token_hash")).toBeTruthy();
  });

  test("reimpostazione password: arriva a Mailpit con il link", async () => {
    const email = uniqueAddress("password");
    await adminClient().auth.admin.createUser({
      email,
      password: "Password-di-prova-1",
      email_confirm: true,
    });
    const since = new Date();

    const { error } = await anonClient().auth.resetPasswordForEmail(email);
    expect(error).toBeNull();

    const message = await waitForLatestEmail(email, { after: since });
    expect(message.Subject).toBe("Reimposta la password · BLVS");
    // BLVS-14: our page, which spends the token only when the user saves.
    const link = new URL(
      await getLatestLink(email, { match: /\/reimposta-password\?/ }),
    );
    expect(link.searchParams.get("token_hash")).toBeTruthy();
  });
});

test("coda email: la Edge Function invia a Mailpit e registra il tentativo", async () => {
  const email = uniqueAddress("tappa");
  const admin = adminClient();
  const { data: queued, error } = await admin
    .from("coda_email")
    .insert({
      destinatario: email,
      modello: "tappa-annullata",
      oggetto: "Tappa annullata: Tappa di prova · BLVS",
      html: '<!DOCTYPE html><html lang="it"><body><a href="https://blvs.example/tappe/prova">Vedi i dettagli</a></body></html>',
      testo: "Vedi i dettagli: https://blvs.example/tappe/prova",
    })
    .select("id")
    .single();
  expect(error).toBeNull();

  const response = await fetch(
    `${supabaseLocal.url}/functions/v1/send-emails`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${supabaseLocal.emailWorkerSecret}` },
    },
  );
  expect(response.status).toBe(200);
  expect(await response.json()).toMatchObject({ mode: "mailpit" });

  expect(await getLatestLink(email)).toBe("https://blvs.example/tappe/prova");
  const message = await waitForLatestEmail(email);
  expect(message.Text).toContain("https://blvs.example/tappe/prova");

  const { data: row } = await admin
    .from("coda_email")
    .select("stato, tentativi")
    .eq("id", queued!.id)
    .single();
  expect(row).toEqual({ stato: "inviata", tentativi: 1 });
});

test("coda email: senza il segreto la Edge Function rifiuta la chiamata", async () => {
  const response = await fetch(
    `${supabaseLocal.url}/functions/v1/send-emails`,
    {
      method: "POST",
      headers: { Authorization: "Bearer sbagliato" },
    },
  );
  expect(response.status).toBe(401);
});
