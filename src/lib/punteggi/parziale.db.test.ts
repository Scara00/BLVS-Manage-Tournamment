// @vitest-environment node
import { beforeEach, describe, expect, it } from "vitest";
import {
  asRole,
  createAuthUser,
  createTestDatabase,
  type TestDatabase,
} from "@/test/pglite";

/*
 * BLVS-37: `salva_parziale` keeps the partial apart from the score. It
 * never touches `punteggi`, the standings or the count of results to
 * enter; it has its own version (conflict 40001 like BLVS-34), writes
 * `punteggio_parziale` in the registro and is cleared when the match
 * leaves `in_corso`.
 */

let db: TestDatabase;
let admin: string;

type PgError = { code?: string; hint?: string; detail?: string };

async function errore(promise: Promise<unknown>): Promise<PgError> {
  try {
    await promise;
  } catch (error) {
    return error as PgError;
  }
  throw new Error("expected an error");
}

function asAdmin<T>(fn: () => Promise<T>) {
  return asRole(db, "authenticated", admin, fn);
}

/** A stage with one started group of 4 on the M board; returns ids. */
async function avviata() {
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
  const tabellone = tb[0].id;
  const { rows: g } = await db.query<{ id: string }>(
    `insert into gironi (tabellone_id, nome, posizione)
     values ($1, 'Girone A', 1) returning id`,
    [tabellone],
  );
  const girone = g[0].id;
  for (const cognome of ["Rinaldi", "Moretti", "Conti", "Gallo"]) {
    const utente = await createAuthUser(db, {
      email: `${cognome}-${crypto.randomUUID()}@example.it`,
    });
    const { rows: i } = await db.query<{ id: string }>(
      `insert into iscrizioni (tappa_id, tabellone_id, utente_id, stato)
       values ($1, $2, $3, 'confermata') returning id`,
      [tappa, tabellone, utente],
    );
    await db.query(
      "insert into girone_iscrizioni (girone_id, iscrizione_id) values ($1, $2)",
      [girone, i[0].id],
    );
  }
  await asAdmin(() => db.query("select * from avvia_fase($1)", [tabellone]));
  const { rows: p } = await db.query<{ id: string }>(
    "select id from partite where girone_id = $1 order by turno",
    [girone],
  );
  return { tappa, girone, partite: p.map((r) => r.id) };
}

async function inCorso(partita: string) {
  await db.query("update partite set stato = 'in_corso' where id = $1", [
    partita,
  ]);
}

function parziale(
  partita: string,
  versione: number,
  a: number,
  b: number,
  sovrascrivi = false,
) {
  return asAdmin(() =>
    db.query<{ versione: number }>(
      "select * from salva_parziale($1, $2, $3, $4, $5)",
      [partita, versione, a, b, sovrascrivi],
    ),
  );
}

async function punteggio(partita: string) {
  const { rows } = await db.query<{
    stato: string;
    sets: unknown;
    versione: number;
  }>(
    `select p.stato, pt.sets, pt.versione
     from partite p join punteggi pt on pt.partita_id = p.id
     where p.id = $1`,
    [partita],
  );
  return rows[0];
}

async function partiteDaInserire(tappa: string) {
  const { rows } = await asAdmin(() =>
    db.query<{ id: string; partite_da_inserire: number }>(
      "select id, partite_da_inserire from admin_riepilogo_tappe()",
    ),
  );
  return Number(rows.find((r) => r.id === tappa)?.partite_da_inserire);
}

beforeEach(async () => {
  db = await createTestDatabase();
  admin = await createAuthUser(db, { email: "admin@example.it" });
  await db.query("update utenti set ruolo = 'admin' where id = $1", [admin]);
});

describe("salva_parziale", () => {
  it("salva il parziale a parte: punteggio, stato e partite da inserire non cambiano", async () => {
    const { tappa, partite } = await avviata();
    await inCorso(partite[0]);
    const prima = await punteggio(partite[0]);
    const daInserire = await partiteDaInserire(tappa);

    const { rows } = await parziale(partite[0], 0, 14, 11);
    expect(rows[0].versione).toBe(1);

    expect(await punteggio(partite[0])).toEqual(prima);
    expect(prima).toMatchObject({ stato: "in_corso", sets: [] });
    expect(await partiteDaInserire(tappa)).toBe(daInserire);
    const { rows: pp } = await db.query(
      "select a, b, versione, aggiornato_da from punteggi_parziali where partita_id = $1",
      [partite[0]],
    );
    expect(pp[0]).toEqual({ a: 14, b: 11, versione: 1, aggiornato_da: admin });
  });

  it("ammette il pareggio, rifiuta valori fuori da 0..99", async () => {
    const { partite } = await avviata();
    await inCorso(partite[0]);
    await parziale(partite[0], 0, 7, 7);
    expect(await errore(parziale(partite[0], 1, 100, 3))).toMatchObject({
      code: "23514",
      hint: "valori_non_validi",
    });
    expect(await errore(parziale(partite[0], 1, -1, 3))).toMatchObject({
      hint: "valori_non_validi",
    });
  });

  it("solo per una partita in corso", async () => {
    const { partite } = await avviata();
    expect(await errore(parziale(partite[0], 0, 1, 0))).toMatchObject({
      code: "23514",
      hint: "partita_non_in_corso",
    });
    await db.query("update partite set stato = 'conclusa' where id = $1", [
      partite[1],
    ]);
    expect(await errore(parziale(partite[1], 0, 1, 0))).toMatchObject({
      hint: "partita_non_in_corso",
    });
  });

  it("versione superata: 40001 con la versione attuale, niente scritto", async () => {
    const { partite } = await avviata();
    await inCorso(partite[0]);
    await parziale(partite[0], 0, 3, 2);
    await parziale(partite[0], 1, 4, 2);
    expect(await errore(parziale(partite[0], 1, 9, 9))).toMatchObject({
      code: "40001",
      hint: "parziale_superato",
      detail: "2",
    });
    const { rows } = await asAdmin(() =>
      db.query("select versione, a, b from parziale_attuale($1)", [partite[0]]),
    );
    expect(rows[0]).toEqual({ versione: 2, a: 4, b: 2 });
  });

  it("solo l'admin", async () => {
    const { partite } = await avviata();
    await inCorso(partite[0]);
    const giocatore = await createAuthUser(db, { email: "g@example.it" });
    expect(
      await errore(
        asRole(db, "authenticated", giocatore, () =>
          db.query("select * from salva_parziale($1, 0, 1, 0)", [partite[0]]),
        ),
      ),
    ).toMatchObject({ code: "42501" });
  });

  it("scrive punteggio_parziale nel registro, con la nota se sovrascrive", async () => {
    const { tappa, partite } = await avviata();
    await inCorso(partite[0]);
    await parziale(partite[0], 0, 5, 3);
    await parziale(partite[0], 1, 6, 3, true);
    const { rows } = await db.query<{
      tipo: string;
      valore_prima: unknown;
      valore_dopo: unknown;
      nota: string | null;
    }>(
      `select tipo, valore_prima, valore_dopo, nota from registro
       where entita = 'punteggi' and entita_id = $1 and tipo is not null
       order by id`,
      [partite[0]],
    );
    expect(rows).toEqual([
      {
        tipo: "punteggio_parziale",
        valore_prima: { parziale: null, versione: 0, tappa_id: tappa },
        valore_dopo: {
          parziale: { a: 5, b: 3 },
          versione: 1,
          tappa_id: tappa,
        },
        nota: null,
      },
      {
        tipo: "punteggio_parziale",
        valore_prima: {
          parziale: { a: 5, b: 3 },
          versione: 1,
          tappa_id: tappa,
        },
        valore_dopo: {
          parziale: { a: 6, b: 3 },
          versione: 2,
          tappa_id: tappa,
        },
        nota: "Sovrascrittura dopo conflitto",
      },
    ]);
  });

  it("si cancella quando la partita finisce (salva_punteggio)", async () => {
    const { partite } = await avviata();
    await inCorso(partite[0]);
    await parziale(partite[0], 0, 19, 18);
    await asAdmin(() =>
      db.query("select * from salva_punteggio($1, 1, 21, 18)", [partite[0]]),
    );
    const { rows } = await db.query(
      "select 1 from punteggi_parziali where partita_id = $1",
      [partite[0]],
    );
    expect(rows).toEqual([]);
    expect((await punteggio(partite[0])).sets).toEqual([{ a: 21, b: 18 }]);
  });
});
