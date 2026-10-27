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
type Riga = { id: string; posto: number; stato: string };

async function createStage({
  stato = "iscrizioni_chiuse",
  posti = 4,
}: { stato?: string; posti?: number } = {}) {
  const { rows } = await db.query<{ id: string }>(
    `insert into tappe (nome, luogo, data_inizio, data_fine, stato, iscrizioni_chiudono_il,
       motivo_annullamento)
     values ('Tappa test', 'Spiaggia', '2099-06-10', '2099-06-11', $1::stato_tappa,
       '2099-06-01 23:59+02', case when $1::text = 'annullata' then 'Maltempo' end)
     returning id`,
    [stato],
  );
  const id = rows[0].id;
  await db.query("update tabelloni set posti = $2 where tappa_id = $1", [
    id,
    posti,
  ]);
  return id;
}

async function createPlayer(categoria: "M" | "F" | null = "M") {
  return createAuthUser(db, {
    email: `${crypto.randomUUID()}@example.it`,
    categoria,
  });
}

async function createAdmin() {
  const id = await createPlayer();
  await db.query("update utenti set ruolo = 'admin' where id = $1", [id]);
  return id;
}

function call<T>(sub: string, sql: string, params: unknown[]) {
  return asRole(db, "authenticated", sub, async () => {
    try {
      const { rows } = await db.query<T>(sql, params);
      return { ok: true as const, row: rows[0] };
    } catch (error) {
      return { ok: false as const, error: error as DbError };
    }
  });
}

function aggiungi(admin: string, tappa: string, utente: string) {
  return call<Riga>(
    admin,
    "select * from public.admin_iscrivi_giocatore($1, $2)",
    [tappa, utente],
  );
}

function rimuovi(admin: string, iscrizione: string) {
  return call<Riga>(
    admin,
    "select * from public.admin_rimuovi_iscrizione($1)",
    [iscrizione],
  );
}

async function attivi(tappa: string) {
  const { rows } = await db.query<{ n: number }>(
    `select count(*)::int as n from iscrizioni
     where tappa_id = $1 and stato in ('in_attesa', 'confermata')`,
    [tappa],
  );
  return rows[0].n;
}

beforeEach(async () => {
  db = await createTestDatabase();
});

describe("admin_iscrivi_giocatore()", () => {
  it("iscrive anche a iscrizioni chiuse, con il primo posto libero, già confermato", async () => {
    const admin = await createAdmin();
    const tappa = await createStage({ stato: "iscrizioni_chiuse" });
    const result = await aggiungi(admin, tappa, await createPlayer());
    expect(result).toMatchObject({
      ok: true,
      row: { posto: 1, stato: "confermata" },
    });
  });

  it("rifiuta l'aggiunta oltre il massimo e non cambia gli iscritti", async () => {
    const admin = await createAdmin();
    const tappa = await createStage({ posti: 2 });
    await aggiungi(admin, tappa, await createPlayer());
    await aggiungi(admin, tappa, await createPlayer());
    const result = await aggiungi(admin, tappa, await createPlayer());
    expect(result).toMatchObject({
      ok: false,
      error: { code: "23514", hint: "posti_esauriti" },
    });
    expect(await attivi(tappa)).toBe(2);
  });

  it("il massimo è per tabellone: il femminile ha ancora posto", async () => {
    const admin = await createAdmin();
    const tappa = await createStage({ posti: 1 });
    await aggiungi(admin, tappa, await createPlayer("M"));
    const result = await aggiungi(admin, tappa, await createPlayer("F"));
    expect(result).toMatchObject({ ok: true, row: { posto: 1 } });
  });

  it("rifiuta un giocatore già iscritto", async () => {
    const admin = await createAdmin();
    const tappa = await createStage();
    const giocatore = await createPlayer();
    await aggiungi(admin, tappa, giocatore);
    const result = await aggiungi(admin, tappa, giocatore);
    expect(result).toMatchObject({
      ok: false,
      error: { code: "23505", hint: "gia_iscritto" },
    });
    expect(await attivi(tappa)).toBe(1);
  });

  it("rifiuta chi non ha categoria e chi non è un giocatore", async () => {
    const admin = await createAdmin();
    const tappa = await createStage();
    expect(
      await aggiungi(admin, tappa, await createPlayer(null)),
    ).toMatchObject({ ok: false, error: { hint: "categoria_mancante" } });
    expect(await aggiungi(admin, tappa, await createAdmin())).toMatchObject({
      ok: false,
      error: { code: "P0002", hint: "giocatore_non_trovato" },
    });
  });

  it.each([
    ["in_corso", "tappa_non_iscrivibile"],
    ["conclusa", "tappa_non_iscrivibile"],
    ["annullata", "tappa_annullata"],
  ])("rifiuta una tappa %s", async (stato, hint) => {
    const admin = await createAdmin();
    const tappa = await createStage({ stato });
    expect(await aggiungi(admin, tappa, await createPlayer())).toMatchObject({
      ok: false,
      error: { hint },
    });
  });

  it("solo l'admin può chiamarla", async () => {
    const tappa = await createStage();
    const giocatore = await createPlayer();
    expect(await aggiungi(giocatore, tappa, giocatore)).toMatchObject({
      ok: false,
      error: { code: "42501" },
    });
  });
});

describe("admin_rimuovi_iscrizione()", () => {
  it("ritira l'iscrizione e il posto torna libero", async () => {
    const admin = await createAdmin();
    const tappa = await createStage({ posti: 2 });
    const primo = await aggiungi(admin, tappa, await createPlayer());
    await aggiungi(admin, tappa, await createPlayer());
    if (!primo.ok) throw new Error("setup");

    const rimosso = await rimuovi(admin, primo.row.id);
    expect(rimosso).toMatchObject({ ok: true, row: { stato: "ritirata" } });
    expect(await attivi(tappa)).toBe(1);

    // The freed seat 1 goes to the next player, even with the board at 2.
    const nuovo = await aggiungi(admin, tappa, await createPlayer());
    expect(nuovo).toMatchObject({ ok: true, row: { posto: 1 } });
  });

  it("lo stesso giocatore si può iscrivere di nuovo dopo la rimozione", async () => {
    const admin = await createAdmin();
    const tappa = await createStage();
    const giocatore = await createPlayer();
    const prima = await aggiungi(admin, tappa, giocatore);
    if (!prima.ok) throw new Error("setup");
    await rimuovi(admin, prima.row.id);

    const di_nuovo = await aggiungi(admin, tappa, giocatore);
    expect(di_nuovo).toMatchObject({ ok: true, row: { posto: 1 } });
    const { rows } = await db.query(
      "select 1 from iscrizioni where utente_id = $1",
      [giocatore],
    );
    expect(rows).toHaveLength(1);
  });

  it("una rimozione ripetuta non trova l'iscrizione", async () => {
    const admin = await createAdmin();
    const tappa = await createStage();
    const iscritto = await aggiungi(admin, tappa, await createPlayer());
    if (!iscritto.ok) throw new Error("setup");
    await rimuovi(admin, iscritto.row.id);
    expect(await rimuovi(admin, iscritto.row.id)).toMatchObject({
      ok: false,
      error: { code: "P0002" },
    });
  });

  it("rifiuta la rimozione da una tappa in corso", async () => {
    const admin = await createAdmin();
    const tappa = await createStage();
    const iscritto = await aggiungi(admin, tappa, await createPlayer());
    if (!iscritto.ok) throw new Error("setup");
    await db.query("update tappe set stato = 'in_corso' where id = $1", [
      tappa,
    ]);
    expect(await rimuovi(admin, iscritto.row.id)).toMatchObject({
      ok: false,
      error: { hint: "tappa_non_iscrivibile" },
    });
  });

  it("solo l'admin può chiamarla", async () => {
    const admin = await createAdmin();
    const tappa = await createStage();
    const iscritto = await aggiungi(admin, tappa, await createPlayer());
    if (!iscritto.ok) throw new Error("setup");
    expect(await rimuovi(await createPlayer(), iscritto.row.id)).toMatchObject({
      ok: false,
      error: { code: "42501" },
    });
  });
});
