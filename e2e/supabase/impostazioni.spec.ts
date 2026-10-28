import { expect, test } from "@playwright/test";
import {
  adminClient,
  anonClient,
  isSupabaseLocalConfigured,
  uniqueAddress,
} from "./env";

const PASSWORD = "Password-di-prova-1";

test.beforeAll(() => {
  if (process.env.CI) {
    expect(isSupabaseLocalConfigured(), "Supabase locale raggiungibile").toBe(
      true,
    );
  }
  test.skip(
    !isSupabaseLocalConfigured(),
    "Serve Supabase locale (supabase start)",
  );
});

async function signedInPlayer(prefix: string) {
  const email = uniqueAddress(prefix);
  const { data, error } = await adminClient().auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
    user_metadata: {
      nome: "Prova",
      cognome: "Impostazioni",
      categoria: "M",
      consenso_privacy: "1.0",
      consenso_privacy_data: "2026-10-27",
    },
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

test.describe("impostazioni (BLVS-53)", () => {
  test("il giocatore legge il proprio consenso con la data dell'informativa", async () => {
    const { id, client } = await signedInPlayer("consenso");
    const { data, error } = await client
      .from("consensi")
      .select("versione_informativa, data_informativa")
      .eq("utente_id", id);
    expect(error).toBeNull();
    expect(data).toEqual([
      { versione_informativa: "1.0", data_informativa: "2026-10-27" },
    ]);
  });

  test("cancella_account elimina utente Auth, email, nome e consensi", async () => {
    const { id, email, client } = await signedInPlayer("cancella");
    const { error } = await client.rpc("cancella_account");
    expect(error).toBeNull();

    const admin = adminClient();
    const { data: auth } = await admin.auth.admin.getUserById(id);
    expect(auth.user).toBeNull();

    const { data: utente } = await admin
      .from("utenti")
      .select("nome, cognome, email, anonimizzato_il")
      .eq("id", id)
      .single();
    expect(utente).toMatchObject({
      nome: "Giocatore",
      cognome: "anonimo",
      email: null,
    });
    expect(utente?.anonimizzato_il).toBeTruthy();

    const { data: consensi } = await admin
      .from("consensi")
      .select("id")
      .eq("utente_id", id);
    expect(consensi).toEqual([]);

    // The old password no longer opens anything.
    const { error: signInError } = await anonClient().auth.signInWithPassword({
      email,
      password: PASSWORD,
    });
    expect(signInError).not.toBeNull();
  });
});
