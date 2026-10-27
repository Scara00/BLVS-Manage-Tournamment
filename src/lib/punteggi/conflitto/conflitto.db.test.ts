// @vitest-environment node
import { beforeEach, describe, expect, it } from "vitest";
import {
  asRole,
  createAuthUser,
  createTestDatabase,
  type TestDatabase,
} from "@/test/pglite";

let db: TestDatabase;
let giulia: string;
let marco: string;

type PgError = { code?: string; hint?: string; detail?: string };

async function errore(promise: Promise<unknown>): Promise<PgError> {
  try {
    await promise;
  } catch (error) {
    return error as PgError;
  }
  throw new Error("expected an error");
}

async function creaAdmin(nome: string, cognome: string) {
  const id = await createAuthUser(db, {
    email: `${nome}-${crypto.randomUUID()}@example.it`,
  });
  await db.query(
    "update utenti set ruolo = 'admin', nome = $2, cognome = $3 where id = $1",
    [id, nome, cognome],
  );
  return id;
}

/** A started group of 4 on the M board; returns its first match. */
async function partitaAvviata() {
  const { rows } = await db.query<{ id: string }>(
    `insert into tappe (nome, luogo, data_inizio, data_fine, stato)
     values ('Tappa test', 'Spiaggia', '2099-07-01', '2099-07-02', 'iscrizioni_chiuse')
     returning id`,
  );
  const tappa = rows[0].id;
  const { rows: tb } = await db.query<{ id: string }>(
    "select id from tabelloni where tappa_id = $1 and categoria = 'M'",
    [tappa],
  );
  const { rows: g } = await db.query<{ id: string }>(
    `insert into gironi (tabellone_id, nome, posizione)
     values ($1, 'Girone A', 1) returning id`,
    [tb[0].id],
  );
  for (let i = 0; i < 4; i++) {
    const utente = await createAuthUser(db, {
      email: `g${i}-${crypto.randomUUID()}@example.it`,
    });
    const { rows: isc } = await db.query<{ id: string }>(
      `insert into iscrizioni (tappa_id, tabellone_id, utente_id, stato)
       values ($1, $2, $3, 'confermata') returning id`,
      [tappa, tb[0].id, utente],
    );
    await db.query(
      "insert into girone_iscrizioni (girone_id, iscrizione_id) values ($1, $2)",
      [g[0].id, isc[0].id],
    );
  }
  await asRole(db, "authenticated", giulia, () =>
    db.query("select * from avvia_fase($1)", [tb[0].id]),
  );
  const { rows: p } = await db.query<{ id: string }>(
    "select id from partite where girone_id = $1 order by turno limit 1",
    [g[0].id],
  );
  return p[0].id;
}

function salva(
  admin: string,
  partita: string,
  versione: number,
  a: number,
  b: number,
) {
  return asRole(db, "authenticated", admin, () =>
    db.query("select * from salva_punteggio($1, $2, $3, $4)", [
      partita,
      versione,
      a,
      b,
    ]),
  );
}

function sovrascrivi(
  admin: string,
  partita: string,
  versioneVista: number,
  a: number,
  b: number,
) {
  return asRole(db, "authenticated", admin, () =>
    db.query<{ versione: number; tipo: string }>(
      "select * from sovrascrivi_punteggio($1, $2, $3, $4)",
      [partita, versioneVista, a, b],
    ),
  );
}

function attuale(admin: string, partita: string) {
  return asRole(db, "authenticated", admin, () =>
    db.query<{
      versione: number;
      sets: unknown;
      autore: string | null;
      aggiornato_il: string;
    }>("select * from punteggio_attuale($1)", [partita]),
  );
}

async function sets(partita: string) {
  const { rows } = await db.query<{ sets: unknown; versione: number }>(
    "select sets, versione from punteggi where partita_id = $1",
    [partita],
  );
  return rows[0];
}

async function eventi(partita: string) {
  const { rows } = await db.query<{
    tipo: string;
    nota: string | null;
    attore_id: string;
    valore_prima: { sets: unknown };
    valore_dopo: { sets: unknown };
  }>(
    `select tipo, nota, attore_id, valore_prima, valore_dopo from registro
     where entita = 'punteggi' and entita_id = $1 and tipo is not null
     order by id`,
    [partita],
  );
  return rows;
}

beforeEach(async () => {
  db = await createTestDatabase();
  giulia = await creaAdmin("Giulia", "Neri");
  marco = await creaAdmin("Marco", "Bassi");
});

describe("conflitto tra admin (BLVS-34)", () => {
  it("il secondo salvataggio sulla stessa versione è rifiutato, senza scrivere", async () => {
    const partita = await partitaAvviata();
    await salva(giulia, partita, 1, 21, 18);
    const e = await errore(salva(marco, partita, 1, 21, 19));
    expect(e).toMatchObject({ code: "40001", hint: "versione_superata" });
    // No silent overwrite: Giulia's value is still the official one.
    expect(await sets(partita)).toEqual({
      sets: [{ a: 21, b: 18 }],
      versione: 2,
    });
    expect(await eventi(partita)).toHaveLength(1);
  });

  it("punteggio_attuale dà il valore ufficiale con autore e ora", async () => {
    const partita = await partitaAvviata();
    await salva(giulia, partita, 1, 21, 18);
    const { rows } = await attuale(marco, partita);
    expect(rows[0]).toMatchObject({
      versione: 2,
      sets: [{ a: 21, b: 18 }],
      autore: "Giulia Neri",
    });
    expect(rows[0].aggiornato_il).toBeTruthy();
  });

  it("«Sovrascrivi» sulla versione vista scrive una correzione annotata", async () => {
    const partita = await partitaAvviata();
    await salva(giulia, partita, 1, 21, 18);
    const { rows } = await sovrascrivi(marco, partita, 2, 21, 19);
    expect(rows[0]).toEqual({ versione: 3, tipo: "correzione_punteggio" });
    expect(await sets(partita)).toEqual({
      sets: [{ a: 21, b: 19 }],
      versione: 3,
    });
    const [primo, secondo] = await eventi(partita);
    expect(primo.nota).toBeNull();
    expect(secondo).toMatchObject({
      tipo: "correzione_punteggio",
      nota: "Sovrascrittura dopo conflitto",
      attore_id: marco,
      valore_prima: { sets: [{ a: 21, b: 18 }] },
      valore_dopo: { sets: [{ a: 21, b: 19 }] },
    });
  });

  it("«Sovrascrivi» non passa se nel frattempo è arrivato un altro salvataggio", async () => {
    const partita = await partitaAvviata();
    await salva(giulia, partita, 1, 21, 18);
    // Marco saw version 2 in the dialog; Giulia corrects again meanwhile.
    await salva(giulia, partita, 2, 21, 16);
    const e = await errore(sovrascrivi(marco, partita, 2, 21, 19));
    expect(e).toMatchObject({
      code: "40001",
      hint: "versione_superata",
      detail: "3",
    });
    expect(await sets(partita)).toEqual({
      sets: [{ a: 21, b: 16 }],
      versione: 3,
    });
  });

  it("la nota resta solo nella transazione della sovrascrittura", async () => {
    const partita = await partitaAvviata();
    await salva(giulia, partita, 1, 21, 18);
    await sovrascrivi(marco, partita, 2, 21, 19);
    await salva(giulia, partita, 3, 21, 15);
    expect((await eventi(partita)).map((e) => e.nota)).toEqual([
      null,
      "Sovrascrittura dopo conflitto",
      null,
    ]);
  });

  it("è riservato all'amministrazione", async () => {
    const partita = await partitaAvviata();
    const giocatore = await createAuthUser(db, { email: "g@example.it" });
    expect(await errore(attuale(giocatore, partita))).toMatchObject({
      code: "42501",
    });
    expect(
      await errore(sovrascrivi(giocatore, partita, 1, 21, 19)),
    ).toMatchObject({ code: "42501" });
  });
});
