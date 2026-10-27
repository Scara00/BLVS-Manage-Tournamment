// @vitest-environment node
import { beforeEach, describe, expect, it } from "vitest";
import {
  asRole,
  createAuthUser,
  createTestDatabase,
  type TestDatabase,
} from "@/test/pglite";

let db: TestDatabase;

async function expectPgError(promise: Promise<unknown>, code: string) {
  await expect(promise).rejects.toMatchObject({ code });
}

async function createStage(nome = "Tappa test", stato = "iscrizioni_aperte") {
  const { rows } = await db.query<{ id: string }>(
    `insert into tappe (nome, luogo, data_inizio, data_fine, stato)
     values ($1, 'Spiaggia', '2027-06-01', '2027-06-02', $2) returning id`,
    [nome, stato],
  );
  return rows[0].id;
}

async function boardOf(tappaId: string, categoria: "M" | "F") {
  const { rows } = await db.query<{ id: string }>(
    "select id from tabelloni where tappa_id = $1 and categoria = $2",
    [tappaId, categoria],
  );
  return rows[0].id;
}

async function register(
  utenteId: string,
  tappaId: string,
  categoria: "M" | "F",
) {
  const { rows } = await db.query<{ id: string }>(
    `insert into iscrizioni (tappa_id, tabellone_id, utente_id)
     values ($1, $2, $3) returning id`,
    [tappaId, await boardOf(tappaId, categoria), utenteId],
  );
  return rows[0].id;
}

beforeEach(async () => {
  db = await createTestDatabase();
});

describe("schema: utenti", () => {
  it("l'email è unica senza distinzione tra maiuscole e minuscole", async () => {
    await createAuthUser(db, { email: "Mario.Rossi@Example.it" });
    await expectPgError(
      createAuthUser(db, { email: "mario.rossi@example.it" }),
      "23505",
    );
  });

  it("un nuovo account è sempre giocatore, anche se i metadati dicono admin", async () => {
    const id = await createAuthUser(db, {
      email: "furbo@example.it",
      meta: { ruolo: "admin", role: "admin" },
    });
    const { rows } = await db.query("select ruolo from utenti where id = $1", [
      id,
    ]);
    expect(rows).toEqual([{ ruolo: "giocatore" }]);
  });

  it("registra il consenso privacy dato alla registrazione", async () => {
    const id = await createAuthUser(db, {
      email: "consenso@example.it",
      meta: { consenso_privacy: "2026-10" },
    });
    const { rows } = await db.query(
      "select tipo, versione_informativa, concesso from consensi where utente_id = $1",
      [id],
    );
    expect(rows).toEqual([
      { tipo: "privacy", versione_informativa: "2026-10", concesso: true },
    ]);
  });

  it("un giocatore non può promuoversi admin", async () => {
    const id = await createAuthUser(db, { email: "g@example.it" });
    await expectPgError(
      asRole(db, "authenticated", id, () =>
        db.query("update utenti set ruolo = 'admin' where id = $1", [id]),
      ),
      "42501",
    );
  });
});

describe("schema: tappe e tabelloni", () => {
  it("ogni nuova tappa ha esattamente i tabelloni M e F", async () => {
    const tappa = await createStage();
    const { rows } = await db.query<{ categoria: string }>(
      "select categoria from tabelloni where tappa_id = $1 order by categoria",
      [tappa],
    );
    expect(rows.map((r) => r.categoria)).toEqual(["M", "F"]);
  });

  it("non ammette un secondo tabellone della stessa categoria", async () => {
    const tappa = await createStage();
    await expectPgError(
      db.query("insert into tabelloni (tappa_id, categoria) values ($1, 'M')", [
        tappa,
      ]),
      "23505",
    );
  });

  it("non lascia eliminare un tabellone finché esiste la tappa", async () => {
    const tappa = await createStage();
    await expectPgError(
      db.query("delete from tabelloni where tappa_id = $1", [tappa]),
      "23514",
    );
    await db.query("delete from tappe where id = $1", [tappa]);
    const { rows } = await db.query(
      "select 1 from tabelloni where tappa_id = $1",
      [tappa],
    );
    expect(rows).toHaveLength(0);
  });

  it("rifiuta una data di fine precedente all'inizio", async () => {
    await expectPgError(
      db.query(
        `insert into tappe (nome, luogo, data_inizio, data_fine)
         values ('X', 'Y', '2027-06-02', '2027-06-01')`,
      ),
      "23514",
    );
  });
});

describe("schema: iscrizioni", () => {
  it("un giocatore si iscrive una sola volta per tappa", async () => {
    const tappa = await createStage();
    const utente = await createAuthUser(db, { email: "uno@example.it" });
    await register(utente, tappa, "M");
    await expectPgError(register(utente, tappa, "M"), "23505");
  });

  it("lo stesso giocatore può iscriversi a tappe diverse", async () => {
    const utente = await createAuthUser(db, { email: "due@example.it" });
    await register(utente, await createStage("A"), "M");
    await expect(
      register(utente, await createStage("B"), "M"),
    ).resolves.toBeTruthy();
  });

  it("il tabellone deve essere della stessa tappa", async () => {
    const tappaA = await createStage("A");
    const tappaB = await createStage("B");
    const utente = await createAuthUser(db, { email: "tre@example.it" });
    await expectPgError(
      db.query(
        "insert into iscrizioni (tappa_id, tabellone_id, utente_id) values ($1, $2, $3)",
        [tappaA, await boardOf(tappaB, "M"), utente],
      ),
      "23503",
    );
  });

  it("senza categoria non ci si può iscrivere", async () => {
    const tappa = await createStage();
    const utente = await createAuthUser(db, {
      email: "senza@example.it",
      categoria: null,
    });
    await expectPgError(register(utente, tappa, "M"), "23514");
  });

  it("il tabellone deve essere della categoria del giocatore", async () => {
    const tappa = await createStage();
    const utente = await createAuthUser(db, {
      email: "f@example.it",
      categoria: "F",
    });
    await expectPgError(register(utente, tappa, "M"), "23514");
  });

  it("un giocatore sta in un solo girone", async () => {
    const tappa = await createStage();
    const board = await boardOf(tappa, "M");
    const utente = await createAuthUser(db, { email: "girone@example.it" });
    const iscrizione = await register(utente, tappa, "M");
    const { rows } = await db.query<{ id: string }>(
      "insert into gironi (tabellone_id, nome) values ($1, 'A'), ($1, 'B') returning id",
      [board],
    );
    await db.query(
      "insert into girone_iscrizioni (girone_id, iscrizione_id) values ($1, $2)",
      [rows[0].id, iscrizione],
    );
    await expectPgError(
      db.query(
        "insert into girone_iscrizioni (girone_id, iscrizione_id) values ($1, $2)",
        [rows[1].id, iscrizione],
      ),
      "23505",
    );
  });
});

describe("schema: punteggi", () => {
  async function createMatch() {
    const tappa = await createStage();
    const { rows } = await db.query<{ id: string }>(
      "insert into partite (tabellone_id) values ($1) returning id",
      [await boardOf(tappa, "M")],
    );
    return rows[0].id;
  }

  it("ogni partita nasce con il punteggio alla versione 1", async () => {
    const partita = await createMatch();
    const { rows } = await db.query(
      "select versione, sets from punteggi where partita_id = $1",
      [partita],
    );
    expect(rows).toEqual([{ versione: 1, sets: [] }]);
  });

  it("ogni modifica deve incrementare la versione di uno", async () => {
    const partita = await createMatch();
    await expectPgError(
      db.query(
        `update punteggi set sets = '[{"a":1,"b":0}]' where partita_id = $1`,
        [partita],
      ),
      "23514",
    );
    await db.query(
      `update punteggi set sets = '[{"a":1,"b":0}]', versione = versione + 1
       where partita_id = $1`,
      [partita],
    );
    // Concorrenza ottimistica: chi aveva letto la versione 1 aggiorna 0 righe.
    const stale = await db.query(
      `update punteggi set sets = '[]', versione = 2
       where partita_id = $1 and versione = 1`,
      [partita],
    );
    expect(stale.affectedRows).toBe(0);
  });
});

describe("schema: registro e consensi", () => {
  it("le modifiche a tappe e punteggi finiscono nel registro, con l'autore", async () => {
    const admin = await createAuthUser(db, {
      email: "admin@example.it",
      categoria: null,
    });
    await db.query("update utenti set ruolo = 'admin' where id = $1", [admin]);

    await asRole(db, "authenticated", admin, () =>
      db.query(
        `insert into tappe (nome, luogo, data_inizio, data_fine)
         values ('Tappa admin', 'Spiaggia', '2027-06-01', '2027-06-02')`,
      ),
    );

    const { rows } = await db.query(
      "select attore_id, azione, entita from registro where entita = 'tappe'",
    );
    expect(rows).toEqual([
      { attore_id: admin, azione: "insert", entita: "tappe" },
    ]);
  });

  it("il registro non si può modificare né cancellare", async () => {
    await createStage();
    await expectPgError(db.query("update registro set azione = 'x'"), "42501");
    await expectPgError(db.query("delete from registro"), "42501");
  });

  it("i consensi sono uno storico in sola aggiunta", async () => {
    const id = await createAuthUser(db, {
      email: "storico@example.it",
      meta: { consenso_privacy: "2026-10" },
    });
    await expectPgError(
      db.query("update consensi set concesso = false where utente_id = $1", [
        id,
      ]),
      "42501",
    );
    // Ma si cancellano insieme all'utente (diritto all'oblio).
    await db.query("delete from auth.users where id = $1", [id]);
    const { rows } = await db.query(
      "select 1 from consensi where utente_id = $1",
      [id],
    );
    expect(rows).toHaveLength(0);
  });
});

describe("schema: dati demo", () => {
  it("il seed si carica e rispetta i vincoli", async () => {
    const seeded = await createTestDatabase({ seed: true });
    const { rows } = await seeded.query<{ ruolo: string; n: number }>(
      "select ruolo::text, count(*)::int as n from utenti group by ruolo order by ruolo",
    );
    expect(rows).toEqual([
      { ruolo: "admin", n: 1 },
      { ruolo: "giocatore", n: 8 },
    ]);
    const tabelloni = await seeded.query<{ n: number }>(
      "select count(*)::int as n from tabelloni",
    );
    expect(tabelloni.rows[0].n).toBe(6);
  });
});

describe("RLS: i permessi li decide il database", () => {
  it("un giocatore non può creare tappe né leggere il registro", async () => {
    const giocatore = await createAuthUser(db, { email: "rls@example.it" });
    await expectPgError(
      asRole(db, "authenticated", giocatore, () =>
        db.query(
          `insert into tappe (nome, luogo, data_inizio, data_fine)
           values ('X', 'Y', '2027-06-01', '2027-06-02')`,
        ),
      ),
      "42501",
    );
    await createStage();
    const registro = await asRole(db, "authenticated", giocatore, () =>
      db.query("select * from registro"),
    );
    expect(registro.rows).toHaveLength(0);
  });

  it("un giocatore vede solo le proprie iscrizioni e i dati degli altri restano privati", async () => {
    const tappa = await createStage();
    const io = await createAuthUser(db, { email: "io@example.it" });
    const altro = await createAuthUser(db, { email: "altro@example.it" });
    await register(io, tappa, "M");
    await register(altro, tappa, "M");

    const { iscrizioni, utenti } = await asRole(
      db,
      "authenticated",
      io,
      async () => ({
        iscrizioni: (
          await db.query<{ utente_id: string }>(
            "select utente_id from iscrizioni",
          )
        ).rows,
        utenti: (await db.query<{ id: string }>("select id from utenti")).rows,
      }),
    );
    expect(iscrizioni).toEqual([{ utente_id: io }]);
    expect(utenti).toEqual([{ id: io }]);
  });

  it("i visitatori non vedono le tappe in bozza", async () => {
    await createStage("Pubblica", "iscrizioni_aperte");
    await createStage("Bozza", "bozza");
    const { rows } = await asRole(db, "anon", null, () =>
      db.query<{ nome: string }>("select nome from tappe"),
    );
    expect(rows).toEqual([{ nome: "Pubblica" }]);
  });

  it("solo il server con la chiave segreta usa il contatore dei tentativi", async () => {
    for (const role of ["anon", "authenticated"] as const) {
      await expectPgError(
        asRole(db, role, null, () =>
          db.query("select * from auth_rate_limit_hit('login:ip:x', 5, 900)"),
        ),
        "42501",
      );
    }
    const { rows } = await db.query<{ consentito: boolean; tentativi: number }>(
      "select consentito, tentativi from auth_rate_limit_hit('login:ip:x', 1, 900)",
    );
    expect(rows).toEqual([{ consentito: true, tentativi: 1 }]);
    const second = await db.query<{ consentito: boolean }>(
      "select consentito from auth_rate_limit_hit('login:ip:x', 1, 900)",
    );
    expect(second.rows[0].consentito).toBe(false);
  });
});
