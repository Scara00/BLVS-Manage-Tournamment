// @vitest-environment node
import { beforeEach, describe, expect, it } from "vitest";
import {
  asRole,
  createAuthUser,
  createTestDatabase,
  type TestDatabase,
} from "@/test/pglite";

let db: TestDatabase;

type DbError = { code?: string; hint?: string; message: string };

async function createStage({
  stato = "iscrizioni_aperte",
  chiudono = "2099-06-01 23:59+02",
  posti = 16,
}: { stato?: string; chiudono?: string | null; posti?: number } = {}) {
  const { rows } = await db.query<{ id: string }>(
    `insert into tappe (nome, luogo, data_inizio, data_fine, stato, iscrizioni_chiudono_il)
     values ('Tappa test', 'Spiaggia', '2099-06-10', '2099-06-11', $1, $2)
     returning id`,
    [stato, chiudono],
  );
  const id = rows[0].id;
  await db.query("update tabelloni set posti = $2 where tappa_id = $1", [
    id,
    posti,
  ]);
  return id;
}

async function createPlayer(categoria: "M" | "F" = "M") {
  const id = await createAuthUser(db, {
    email: `${crypto.randomUUID()}@example.it`,
    categoria,
  });
  await db.query(
    "update auth.users set email_confirmed_at = now() where id = $1",
    [id],
  );
  return id;
}

async function createAdmin() {
  const id = await createPlayer();
  await db.query("update utenti set ruolo = 'admin' where id = $1", [id]);
  return id;
}

/** `iscriviti_tappa()` as the player: the row, or the database error. */
function iscriviti(utente: string, tappa: string) {
  return asRole(db, "authenticated", utente, async () => {
    try {
      const { rows } = await db.query<{ posto: number; stato: string }>(
        "select * from public.iscriviti_tappa($1)",
        [tappa],
      );
      return { ok: true as const, row: rows[0] };
    } catch (error) {
      return { ok: false as const, error: error as DbError };
    }
  });
}

function tabelloni(sub: string | null, tappa: string) {
  return asRole(db, sub ? "authenticated" : "anon", sub, async () => {
    const { rows } = await db.query<{
      categoria: string;
      posti: number;
      occupati: number;
      prossimo_posto: number | null;
    }>("select * from public.tabelloni_tappa($1)", [tappa]);
    return rows;
  });
}

beforeEach(async () => {
  db = await createTestDatabase();
});

describe("iscriviti_tappa(): posto garantito", () => {
  it("iscrive il giocatore nel tabellone della sua categoria con il primo posto libero", async () => {
    const tappa = await createStage();
    const a = await iscriviti(await createPlayer(), tappa);
    const b = await iscriviti(await createPlayer(), tappa);
    const f = await iscriviti(await createPlayer("F"), tappa);
    expect(a).toMatchObject({
      ok: true,
      row: { posto: 1, stato: "in_attesa" },
    });
    expect(b).toMatchObject({ ok: true, row: { posto: 2 } });
    expect(f).toMatchObject({ ok: true, row: { posto: 1 } });
  });

  it("riusa il posto di chi si è ritirato", async () => {
    const tappa = await createStage();
    const primo = await createPlayer();
    await iscriviti(primo, tappa);
    await iscriviti(await createPlayer(), tappa);
    await db.query(
      "update iscrizioni set stato = 'ritirata' where utente_id = $1",
      [primo],
    );
    const terzo = await iscriviti(await createPlayer(), tappa);
    expect(terzo).toMatchObject({ ok: true, row: { posto: 1 } });
  });

  it("50 richieste per l'ultimo posto danno una sola iscrizione", async () => {
    const tappa = await createStage({ posti: 3 });
    await iscriviti(await createPlayer(), tappa);
    await iscriviti(await createPlayer(), tappa);
    const players = await Promise.all(
      Array.from({ length: 50 }, () => createPlayer()),
    );
    // PGlite has one connection and `asRole` sets session state, so the
    // requests run one after the other: this checks the count, not the lock.
    // The real concurrent run is e2e/supabase/iscrizioni-concorrenza.spec.ts.
    const results = [];
    for (const p of players) results.push(await iscriviti(p, tappa));
    const ok = results.filter((r) => r.ok);
    const esaurite = results.filter(
      (r) => !r.ok && r.error.hint === "posti_esauriti",
    );
    expect(ok).toHaveLength(1);
    expect(esaurite).toHaveLength(49);
    const { rows } = await db.query<{ n: number }>(
      `select count(*)::int as n from iscrizioni i
       join tabelloni t on t.id = i.tabellone_id
       where t.tappa_id = $1 and t.categoria = 'M'`,
      [tappa],
    );
    expect(rows[0].n).toBe(3);
  });

  it("rifiuta una seconda iscrizione alla stessa tappa", async () => {
    const tappa = await createStage();
    const player = await createPlayer();
    await iscriviti(player, tappa);
    const again = await iscriviti(player, tappa);
    expect(again).toMatchObject({
      ok: false,
      error: { code: "23505", hint: "gia_iscritto" },
    });
  });

  it.each([
    ["annullata", "annullata"],
    ["iscrizioni_chiuse", "chiuse"],
    ["in_corso", "chiuse"],
  ])("tappa %s: rifiutata con hint %s", async (stato, hint) => {
    const tappa = await createStage({ stato });
    const result = await iscriviti(await createPlayer(), tappa);
    expect(result).toMatchObject({ ok: false, error: { code: "23514", hint } });
  });

  it("scadenza passata (orologio del server): rifiutata anche se lo stato è aperto", async () => {
    const tappa = await createStage({ chiudono: "2020-01-01 00:00+01" });
    const result = await iscriviti(await createPlayer(), tappa);
    expect(result).toMatchObject({
      ok: false,
      error: { code: "23514", hint: "scadute" },
    });
  });

  it("bozza e tappa inesistente danno lo stesso errore P0002", async () => {
    const bozza = await createStage({ stato: "bozza" });
    const player = await createPlayer();
    const a = await iscriviti(player, bozza);
    const b = await iscriviti(player, crypto.randomUUID());
    expect(a).toMatchObject({ ok: false, error: { code: "P0002" } });
    expect(b).toMatchObject({ ok: false, error: { code: "P0002" } });
    expect(!a.ok && a.error.message).toBe(!b.ok && b.error.message);
  });

  it("senza categoria: hint categoria_mancante", async () => {
    const tappa = await createStage();
    const player = await createPlayer();
    await db.query("update utenti set categoria = null where id = $1", [
      player,
    ]);
    const result = await iscriviti(player, tappa);
    expect(result).toMatchObject({
      ok: false,
      error: { hint: "categoria_mancante" },
    });
  });

  it("l'admin può iscrivere oltre il massimo", async () => {
    const tappa = await createStage({ posti: 1 });
    await iscriviti(await createPlayer(), tappa);
    const admin = await createAdmin();
    const giocatore = await createPlayer();
    await asRole(db, "authenticated", admin, () =>
      db.query(
        `insert into iscrizioni (tappa_id, tabellone_id, utente_id)
         select $1, id, $2 from tabelloni where tappa_id = $1 and categoria = 'M'`,
        [tappa, giocatore],
      ),
    );
    const { rows } = await db.query<{ posto: number }>(
      "select posto from iscrizioni where utente_id = $1",
      [giocatore],
    );
    expect(rows[0].posto).toBe(2);
  });
});

describe("tabelloni_tappa(): posti di una tappa", () => {
  it("restituisce posti, occupati e prossimo posto per M e F", async () => {
    const tappa = await createStage({ posti: 4 });
    await iscriviti(await createPlayer(), tappa);
    const rows = await tabelloni(await createPlayer(), tappa);
    expect(rows).toMatchObject([
      { categoria: "M", posti: 4, occupati: 1, prossimo_posto: 2 },
      { categoria: "F", posti: 4, occupati: 0, prossimo_posto: 1 },
    ]);
  });

  it("tabellone pieno: nessun prossimo posto", async () => {
    const tappa = await createStage({ posti: 1 });
    await iscriviti(await createPlayer(), tappa);
    const [m] = await tabelloni(null, tappa);
    expect(m).toMatchObject({ occupati: 1, prossimo_posto: null });
  });

  it("una bozza non restituisce righe ai giocatori, sì all'admin", async () => {
    const bozza = await createStage({ stato: "bozza" });
    expect(await tabelloni(await createPlayer(), bozza)).toEqual([]);
    expect(await tabelloni(null, bozza)).toEqual([]);
    expect(await tabelloni(await createAdmin(), bozza)).toHaveLength(2);
  });
});
