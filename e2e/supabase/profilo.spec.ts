import { expect, test } from "@playwright/test";
import {
  isMailpitAvailable,
  waitForLatestEmail,
  extractLinks,
} from "../mailpit";
import {
  adminClient,
  anonClient,
  isSupabaseLocalConfigured,
  uniqueAddress,
} from "./env";

const PASSWORD = "Password-di-prova-1";

test.beforeAll(async () => {
  const ready = isSupabaseLocalConfigured() && (await isMailpitAvailable());
  if (process.env.CI) {
    expect(ready, "Supabase locale e Mailpit raggiungibili").toBe(true);
  }
  test.skip(!ready, "Serve Supabase locale (supabase start) con Mailpit");
});

/** A confirmed player with a session client, like the profile pages use. */
async function signedInPlayer(prefix: string) {
  const email = uniqueAddress(prefix);
  const { data, error } = await adminClient().auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
    user_metadata: { nome: "Prova", cognome: "Profilo", categoria: "M" },
  });
  expect(error).toBeNull();
  const client = anonClient();
  const { error: signInError } = await client.auth.signInWithPassword({
    email,
    password: PASSWORD,
  });
  expect(signInError).toBeNull();
  return { id: data.user!.id, email, client };
}

async function profileEmail(id: string) {
  const { data } = await adminClient()
    .from("utenti")
    .select("email")
    .eq("id", id)
    .single();
  return data?.email;
}

async function confirmationLink(address: string, after: Date) {
  const message = await waitForLatestEmail(address, { after });
  expect(message.Subject).toBe("Conferma il cambio di indirizzo email · BLVS");
  const link = extractLinks(message).find((l) => /\/auth\/v1\/verify/.test(l));
  expect(link).toBeTruthy();
  expect(new URL(link!).searchParams.get("type")).toBe("email_change");
  return link!;
}

test.describe("profilo: cambio email con riconferma", () => {
  test("la nuova email sostituisce la precedente solo dopo le due conferme", async () => {
    const { id, email, client } = await signedInPlayer("cambio");
    const nuova = uniqueAddress("nuova");
    const since = new Date();

    const { data, error } = await client.auth.updateUser({ email: nuova });
    expect(error).toBeNull();
    expect(data.user?.new_email).toBe(nuova);
    // Nothing changes before the links are opened.
    expect(await profileEmail(id)).toBe(email);

    // double_confirm_changes: one link to the old and one to the new address.
    const links = [
      await confirmationLink(email, since),
      await confirmationLink(nuova, since),
    ];
    await fetch(links[0], { redirect: "manual" });
    expect(await profileEmail(id)).toBe(email);
    await fetch(links[1], { redirect: "manual" });

    await expect.poll(() => profileEmail(id)).toBe(nuova);
  });

  test("non si può passare all'email di un altro account", async () => {
    const altro = await signedInPlayer("occupata");
    const { client } = await signedInPlayer("richiedente");
    const { error } = await client.auth.updateUser({
      email: altro.email.toUpperCase(),
    });
    expect(error?.code).toBe("email_exists");
  });
});

test.describe("profilo: categoria", () => {
  test("il giocatore senza tappe giocate cambia categoria", async () => {
    const { id, client } = await signedInPlayer("categoria");
    const { error } = await client
      .from("utenti")
      .update({ categoria: "F" })
      .eq("id", id);
    expect(error).toBeNull();
    const { data } = await client.rpc("stato_categoria", { p_utente: id });
    expect(data).toBe("modificabile");
  });

  test("dopo la prima tappa giocata il server rifiuta il cambio", async () => {
    // Seed: Marco Rossi is confirmed on «Tappa 1 · Jesolo», in corso.
    const client = anonClient();
    const { data: session, error: signInError } =
      await client.auth.signInWithPassword({
        email: "marco.rossi@blvs.test",
        password: "Demo-BLVS-2026!",
      });
    expect(signInError).toBeNull();
    const id = session.user!.id;

    const { data: stato } = await client.rpc("stato_categoria", {
      p_utente: id,
    });
    expect(stato).toBe("bloccata");

    const { error } = await client
      .from("utenti")
      .update({ categoria: "F" })
      .eq("id", id);
    expect(error).toMatchObject({ code: "23514", hint: "categoria_bloccata" });
  });
});
