// @vitest-environment node
import { beforeEach, describe, expect, it } from "vitest";
import {
  asRole,
  createAuthUser,
  createTestDatabase,
  type TestDatabase,
} from "@/test/pglite";
import type { DatiClassificaGenerale } from "@/lib/classifica-generale/dati";
import { NOME_ANONIMO } from "@/lib/classifica-generale/giocatore";

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
     values ('Tappa', 'Spiaggia', '2026-07-18', '2026-07-18', $1::stato_tappa)
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

async function giocatore(cognome: string) {
  const id = await createAuthUser(db, {
    email: `${cognome.toLowerCase()}@example.it`,
  });
  await db.query(
    "update utenti set nome = 'Luca', cognome = $2 where id = $1",
    [id, cognome],
  );
  return id;
}

async function iscrivi(tappaId: string, utente: string) {
  const { rows } = await db.query<{ id: string }>(
    `insert into iscrizioni (tappa_id, tabellone_id, utente_id, stato)
     values ($1, $2, $3, 'confermata') returning id`,
    [tappaId, await tabellone(tappaId), utente],
  );
  return rows[0].id;
}

/** A stage in progress with a gold final of 4, one match concluded. */
async function finale(utenti: string[]) {
  const id = await tappa("in_corso");
  const iscrizioni = [];
  for (const u of utenti) iscrizioni.push(await iscrivi(id, u));
  const { rows } = await db.query<{ id: string }>(
    `insert into gironi (tabellone_id, nome, posizione, fase)
     values ($1, 'Finale gold', 1, 'finale_gold') returning id`,
    [await tabellone(id)],
  );
  const girone = rows[0].id;
  for (const i of iscrizioni) {
    await db.query(
      "insert into girone_iscrizioni (girone_id, iscrizione_id) values ($1, $2)",
      [girone, i],
    );
  }
  const partita = await db.query<{ id: string }>(
    `insert into partite (tabellone_id, girone_id, fase, stato)
     values ($1, $2, 'finale', 'conclusa') returning id`,
    [await tabellone(id), girone],
  );
  for (const [k, i] of iscrizioni.entries()) {
    await db.query(
      "insert into partita_giocatori (partita_id, iscrizione_id, squadra) values ($1, $2, $3)",
      [partita.rows[0].id, i, k < 2 ? "A" : "B"],
    );
  }
  await db.query(
    `update punteggi set sets = '[{"a":21,"b":15}]'::jsonb, versione = versione + 1
     where partita_id = $1`,
    [partita.rows[0].id],
  );
  return { id, iscrizioni };
}

function utente(id: string) {
  return db
    .query<{
      nome: string;
      cognome: string;
      email: string | null;
      anonimizzato_il: string | null;
    }>(
      "select nome, cognome, email, anonimizzato_il from utenti where id = $1",
      [id],
    )
    .then((r) => r.rows[0]);
}

function cancella(id: string) {
  return asRole(db, "authenticated", id, () =>
    db.query("select cancella_account() as ok"),
  );
}

beforeEach(async () => {
  db = await createTestDatabase();
  admin = await createAuthUser(db, { email: "admin@example.it" });
  await db.query("update utenti set ruolo = 'admin' where id = $1", [admin]);
});

describe("nome_anonimo", () => {
  it("è lo stesso nome della scheda (NOME_ANONIMO)", async () => {
    const { rows } = await db.query<{ nome: string; cognome: string }>(
      "select nome, cognome from nome_anonimo()",
    );
    expect(`${rows[0].nome} ${rows[0].cognome}`).toBe(NOME_ANONIMO);
  });
});

describe("cancella_account", () => {
  it("toglie nome ed email, tiene l'utente e le iscrizioni giocate", async () => {
    const id = await giocatore("Rossi");
    const vecchia = await tappa("conclusa");
    const iscrizione = await iscrivi(vecchia, id);

    await cancella(id);

    const riga = await utente(id);
    expect(`${riga.nome} ${riga.cognome}`).toBe(NOME_ANONIMO);
    expect(riga.email).toBeNull();
    expect(riga.anonimizzato_il).not.toBeNull();
    const { rows } = await db.query<{ stato: string }>(
      "select stato from iscrizioni where id = $1",
      [iscrizione],
    );
    expect(rows[0].stato).toBe("confermata");
  });

  it("cancella i consensi, come faceva la cascata sull'utente", async () => {
    const id = await createAuthUser(db, {
      email: "consenso@example.it",
      meta: { consenso_privacy: "2026-10" },
    });
    await cancella(id);
    const { rows } = await db.query(
      "select 1 from consensi where utente_id = $1",
      [id],
    );
    expect(rows).toHaveLength(0);
  });

  it("ritira le iscrizioni delle tappe non ancora iniziate", async () => {
    const id = await giocatore("Bianchi");
    const aperta = await tappa("iscrizioni_aperte");
    const iscrizione = await iscrivi(aperta, id);
    await cancella(id);
    const { rows } = await db.query<{ stato: string }>(
      "select stato from iscrizioni where id = $1",
      [iscrizione],
    );
    expect(rows[0].stato).toBe("ritirata");
  });

  it("non scrive nome ed email nel registro tecnico", async () => {
    const id = await giocatore("Verdi");
    await cancella(id);
    const { rows } = await db.query<{ dati: unknown; azione: string }>(
      "select azione, dati from registro where entita = 'utenti' and entita_id = $1",
      [id],
    );
    expect(rows.map((r) => r.azione)).toEqual(["anonimizzazione"]);
    expect(JSON.stringify(rows)).not.toContain("verdi@example.it");
  });

  it("rifiuta con una tappa in corso e per gli admin", async () => {
    const id = await giocatore("Neri");
    await finale([
      id,
      await giocatore("A"),
      await giocatore("B"),
      await giocatore("C"),
    ]);
    expect((await errore(cancella(id))).hint).toBe("tappa_in_corso");
    expect((await errore(cancella(admin))).hint).toBe("account_admin");
    expect((await utente(id)).anonimizzato_il).toBeNull();
  });

  it("una volta sola, e l'account cancellato non si modifica più", async () => {
    const id = await giocatore("Gialli");
    await cancella(id);
    expect((await errore(cancella(id))).hint).toBe("gia_cancellato");
    const e = await errore(
      asRole(db, "authenticated", id, () =>
        db.query("update utenti set nome = 'Torno' where id = $1", [id]),
      ),
    );
    expect(e.hint).toBe("account_cancellato");
  });

  it("nessuno imposta il segno a mano né chiama anonimizza_utente", async () => {
    const id = await giocatore("Blu");
    const e = await errore(
      asRole(db, "authenticated", id, () =>
        db.query("update utenti set anonimizzato_il = now() where id = $1", [
          id,
        ]),
      ),
    );
    expect(e.code).toBe("42501");
    const e2 = await errore(
      asRole(db, "authenticated", admin, () =>
        db.query("select anonimizza_utente($1)", [id]),
      ),
    );
    expect(e2.code).toBe("42501");
  });
});

describe("eliminazione dell'account Auth", () => {
  it("anonimizza invece di cancellare i risultati", async () => {
    const giocatori = [
      await giocatore("Uno"),
      await giocatore("Due"),
      await giocatore("Tre"),
      await giocatore("Quattro"),
    ];
    const { iscrizioni } = await finale(giocatori);
    await db.query("delete from auth.users where id = $1", [giocatori[0]]);

    expect((await utente(giocatori[0])).anonimizzato_il).not.toBeNull();
    const { rows } = await db.query<{ n: number }>(
      "select count(*) as n from iscrizioni where id = $1",
      [iscrizioni[0]],
    );
    expect(Number(rows[0].n)).toBe(1);
  });
});

describe("classifica_generale_dati", () => {
  it("segna gli account cancellati senza dati personali", async () => {
    const giocatori = [
      await giocatore("Uno"),
      await giocatore("Due"),
      await giocatore("Tre"),
      await giocatore("Quattro"),
    ];
    await finale(giocatori);
    await db.query("delete from auth.users where id = $1", [giocatori[0]]);

    const dati = await asRole(db, "anon", null, async () => {
      const { rows } = await db.query<{ dati: DatiClassificaGenerale }>(
        "select classifica_generale_dati('M', null) as dati",
      );
      return rows[0].dati;
    });
    const anonimo = dati.iscrizioni.find((i) => i.utente_id === giocatori[0]);
    expect(anonimo).toMatchObject({ anonimo: true });
    expect(`${anonimo?.nome} ${anonimo?.cognome}`).toBe(NOME_ANONIMO);
    expect(JSON.stringify(dati)).not.toContain("Uno");
    expect(
      dati.iscrizioni.find((i) => i.utente_id === giocatori[1]),
    ).toMatchObject({ anonimo: false, cognome: "Due" });
  });
});
