import { expect, test } from "@playwright/test";
import {
  adminClient,
  anonClient,
  isSupabaseLocalConfigured,
  uniqueAddress,
} from "./env";

/*
 * BLVS-24 on real Postgres (PGlite runs one statement at a time, so only
 * here do the transactions really overlap): 50 players ask at once for the
 * last seat of a board and exactly one gets it.
 */

const PASSWORD = "Password-di-prova-1";

test.beforeAll(() => {
  const ready = isSupabaseLocalConfigured();
  if (process.env.CI) expect(ready, "Supabase locale raggiungibile").toBe(true);
  test.skip(!ready, "Serve Supabase locale (supabase start)");
});

async function signedInPlayer() {
  const email = uniqueAddress("posto");
  const { error } = await adminClient().auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
    user_metadata: { nome: "Prova", cognome: "Posto", categoria: "M" },
  });
  expect(error).toBeNull();
  const client = anonClient();
  const { error: signInError } = await client.auth.signInWithPassword({
    email,
    password: PASSWORD,
  });
  expect(signInError).toBeNull();
  return client;
}

async function createStage(stato: string, posti: number) {
  const admin = adminClient();
  const { data, error } = await admin
    .from("tappe")
    .insert({
      nome: `Concorrenza ${crypto.randomUUID().slice(0, 8)}`,
      luogo: "Spiaggia di prova",
      data_inizio: "2099-06-10",
      data_fine: "2099-06-10",
      stato,
      iscrizioni_chiudono_il: "2099-06-01T21:59:00Z",
    })
    .select("id")
    .single();
  expect(error).toBeNull();
  await admin.from("tabelloni").update({ posti }).eq("tappa_id", data!.id);
  return data!.id as string;
}

test("50 richieste contemporanee per l'ultimo posto: una sola iscrizione", async () => {
  test.setTimeout(120_000);
  const tappa = await createStage("iscrizioni_aperte", 2);
  const primo = await signedInPlayer();
  const { error } = await primo.rpc("iscriviti_tappa", { p_tappa: tappa });
  expect(error).toBeNull();

  const players = await Promise.all(
    Array.from({ length: 50 }, () => signedInPlayer()),
  );
  const results = await Promise.all(
    players.map((client) =>
      client.rpc("iscriviti_tappa", { p_tappa: tappa }).select("posto"),
    ),
  );

  const ok = results.filter((r) => !r.error);
  expect(ok).toHaveLength(1);
  expect(
    results.filter((r) => r.error?.hint === "posti_esauriti"),
  ).toHaveLength(49);

  const { data: righe } = await adminClient()
    .from("iscrizioni")
    .select("posto, tabelloni!inner(tappa_id, categoria)")
    .eq("tabelloni.tappa_id", tappa)
    .eq("tabelloni.categoria", "M");
  expect(righe?.map((r) => r.posto).sort()).toEqual([1, 2]);
});

test("bozza: invisibile e iscrizione rifiutata come tappa inesistente", async () => {
  const bozza = await createStage("bozza", 16);
  const client = await signedInPlayer();

  const { data } = await client.from("tappe").select("id").eq("id", bozza);
  expect(data).toEqual([]);
  const { data: tabelloni } = await client.rpc("tabelloni_tappa", {
    p_tappa: bozza,
  });
  expect(tabelloni).toEqual([]);

  const a = await client.rpc("iscriviti_tappa", { p_tappa: bozza });
  const b = await client.rpc("iscriviti_tappa", {
    p_tappa: crypto.randomUUID(),
  });
  expect(a.error?.code).toBe("P0002");
  expect(a.error?.message).toBe(b.error?.message);
});
