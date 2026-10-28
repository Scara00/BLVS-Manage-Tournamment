// @vitest-environment node
import { beforeEach, describe, expect, it } from "vitest";
import {
  asRole,
  createAuthUser,
  createTestDatabase,
  type TestDatabase,
} from "@/test/pglite";

let db: TestDatabase;
let admin: string;

type PgError = { code?: string; hint?: string };

async function errore(promise: Promise<unknown>): Promise<PgError> {
  try {
    await promise;
  } catch (error) {
    return error as PgError;
  }
  throw new Error("expected an error");
}

async function tappa(stato: string) {
  const { rows } = await db.query<{ id: string }>(
    `insert into tappe (nome, luogo, data_inizio, data_fine, stato)
     values ('Tappa test', 'Spiaggia', '2026-07-01', '2026-07-02', $1::stato_tappa)
     returning id`,
    [stato],
  );
  return rows[0].id;
}

async function tabellone(tappaId: string) {
  const { rows } = await db.query<{ id: string }>(
    "select id from tabelloni where tappa_id = $1 and categoria = 'M'",
    [tappaId],
  );
  return rows[0].id;
}

/** A stage with four players, a group and a played match, then archived. */
async function tappaArchiviataGiocata() {
  const id = await tappa("in_corso");
  const tb = await tabellone(id);
  const iscrizioni: string[] = [];
  for (const nome of ["anna", "bruno", "carla", "dario"]) {
    const utente = await createAuthUser(db, { email: `${nome}@example.it` });
    const { rows } = await db.query<{ id: string }>(
      `insert into iscrizioni (tappa_id, tabellone_id, utente_id, stato)
       values ($1, $2, $3, 'confermata') returning id`,
      [id, tb, utente],
    );
    iscrizioni.push(rows[0].id);
  }
  const girone = (
    await db.query<{ id: string }>(
      `insert into gironi (tabellone_id, nome, posizione, fase)
       values ($1, 'Girone A', 1, 'iniziale') returning id`,
      [tb],
    )
  ).rows[0].id;
  for (const i of iscrizioni) {
    await db.query(
      "insert into girone_iscrizioni (girone_id, iscrizione_id) values ($1, $2)",
      [girone, i],
    );
  }
  const partita = (
    await db.query<{ id: string }>(
      `insert into partite (tabellone_id, girone_id, fase, stato)
       values ($1, $2, 'gironi', 'conclusa') returning id`,
      [tb, girone],
    )
  ).rows[0].id;
  for (const [i, squadra] of iscrizioni.map((i, n) => [i, n < 2 ? "A" : "B"])) {
    await db.query(
      "insert into partita_giocatori (partita_id, iscrizione_id, squadra) values ($1, $2, $3)",
      [partita, i, squadra],
    );
  }
  await db.query(
    `update punteggi set sets = '[{"a":21,"b":15}]'::jsonb, versione = versione + 1
     where partita_id = $1`,
    [partita],
  );
  await db.query(
    "update tabelloni set concluso_il = now() where tappa_id = $1",
    [id],
  );
  await db.query("update tappe set stato = 'conclusa' where id = $1", [id]);
  await db.query("update tappe set stato = 'archiviata' where id = $1", [id]);
  return { id, partita, iscrizioni };
}

function elimina(utente: string, id: string) {
  return asRole(db, "authenticated", utente, async () => {
    const { rows } = await db.query<{
      elimina_tappa: { nome: string; stagione: number; in_classifica: boolean };
    }>("select elimina_tappa($1)", [id]);
    return rows[0].elimina_tappa;
  });
}

async function conta(sql: string, param: string) {
  const { rows } = await db.query<{ n: number }>(sql, [param]);
  return Number(rows[0].n);
}

beforeEach(async () => {
  db = await createTestDatabase();
  admin = await createAuthUser(db, { email: "admin@example.it" });
  await db.query("update utenti set ruolo = 'admin' where id = $1", [admin]);
});

describe("elimina_tappa", () => {
  it("elimina una tappa archiviata con tutto ciò che le appartiene", async () => {
    const { id, partita, iscrizioni } = await tappaArchiviataGiocata();

    const esito = await elimina(admin, id);
    expect(esito).toMatchObject({ nome: "Tappa test", in_classifica: true });

    expect(
      await conta("select count(*) as n from tappe where id = $1", id),
    ).toBe(0);
    expect(
      await conta(
        "select count(*) as n from tabelloni where tappa_id = $1",
        id,
      ),
    ).toBe(0);
    expect(
      await conta(
        "select count(*) as n from iscrizioni where tappa_id = $1",
        id,
      ),
    ).toBe(0);
    expect(
      await conta(
        "select count(*) as n from girone_iscrizioni where iscrizione_id = any(array[$1]::uuid[])",
        iscrizioni[0],
      ),
    ).toBe(0);
    expect(
      await conta("select count(*) as n from partite where id = $1", partita),
    ).toBe(0);
    expect(
      await conta(
        "select count(*) as n from punteggi where partita_id = $1",
        partita,
      ),
    ).toBe(0);
    // The players' accounts stay.
    expect(
      await conta(
        "select count(*) as n from utenti where ruolo = $1",
        "giocatore",
      ),
    ).toBe(4);
    // The technical log keeps the deleted stage.
    expect(
      await conta(
        "select count(*) as n from registro where entita = 'tappe' and azione = 'delete' and entita_id = $1",
        id,
      ),
    ).toBe(1);
  });

  it("una bozza non era in classifica", async () => {
    const id = await tappa("bozza");
    expect((await elimina(admin, id)).in_classifica).toBe(false);
  });

  it("un DELETE diretto di una tappa archiviata resta vietato", async () => {
    const { id } = await tappaArchiviataGiocata();
    const e = await errore(
      asRole(db, "authenticated", admin, () =>
        db.query("delete from tappe where id = $1", [id]),
      ),
    );
    expect(e.hint).toBe("tappa_archiviata");
  });

  it("solo l'admin elimina", async () => {
    const id = await tappa("iscrizioni_aperte");
    const giocatore = await createAuthUser(db, { email: "g@example.it" });
    expect((await errore(elimina(giocatore, id))).code).toBe("42501");
    expect(
      await conta("select count(*) as n from tappe where id = $1", id),
    ).toBe(1);
  });

  it("una tappa inesistente dà errore", async () => {
    const e = await errore(elimina(admin, crypto.randomUUID()));
    expect(e.hint).toBe("tappa_non_trovata");
  });
});
