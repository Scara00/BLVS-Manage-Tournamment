// @vitest-environment node
import { beforeEach, describe, expect, it } from "vitest";
import {
  asRole,
  createAuthUser,
  createTestDatabase,
  type TestDatabase,
} from "@/test/pglite";
import { REGOLA_SET } from "./regola";
import { codiceErrore } from "./validazione";

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
async function tappaConGirone(stato = "iscrizioni_chiuse") {
  const { rows } = await db.query<{ id: string }>(
    `insert into tappe (nome, luogo, data_inizio, data_fine, stato)
     values ('Tappa test', 'Spiaggia', '2099-07-01', '2099-07-02', $1::stato_tappa)
     returning id`,
    [stato],
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
    await db.query("update utenti set cognome = $2, nome = 'N' where id = $1", [
      utente,
      cognome,
    ]);
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
  return { tappa, tabellone, girone };
}

async function avviata() {
  const ids = await tappaConGirone();
  await asAdmin(() =>
    db.query("select * from avvia_fase($1)", [ids.tabellone]),
  );
  const { rows } = await db.query<{ id: string }>(
    "select id from partite where girone_id = $1 order by turno",
    [ids.girone],
  );
  return { ...ids, partite: rows.map((r) => r.id) };
}

function salva(partita: string, versione: number, a: number, b: number) {
  return asAdmin(() =>
    db.query<{ versione: number; tipo: string }>(
      "select * from salva_punteggio($1, $2, $3, $4)",
      [partita, versione, a, b],
    ),
  );
}

function annulla(partita: string, versione: number) {
  return asAdmin(() =>
    db.query<{ annulla_punteggio: number }>(
      "select annulla_punteggio($1, $2)",
      [partita, versione],
    ),
  );
}

async function statoPartita(partita: string) {
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

async function eventi(partita: string) {
  const { rows } = await db.query<{
    tipo: string;
    valore_prima: unknown;
    valore_dopo: unknown;
  }>(
    `select tipo, valore_prima, valore_dopo from registro
     where entita = 'punteggi' and entita_id = $1 and tipo is not null
     order by id`,
    [partita],
  );
  return rows;
}

beforeEach(async () => {
  db = await createTestDatabase();
  admin = await createAuthUser(db, { email: "admin@example.it" });
  await db.query("update utenti set ruolo = 'admin' where id = $1", [admin]);
});

describe("regola del set", () => {
  it("la regola SQL è la stessa di REGOLA_SET", async () => {
    const { rows } = await db.query<{ punti: number; scarto: number }>(
      "select * from regola_set()",
    );
    expect(rows[0]).toEqual(REGOLA_SET);
  });

  it("valida_punteggio dà gli stessi codici di codiceErrore", async () => {
    const casi: [number, number][] = [];
    for (let a = 0; a <= 30; a++) {
      for (const b of [0, 5, 19, 20, 21, 22, 23, 24, 28, 30]) casi.push([a, b]);
    }
    casi.push([-1, 21], [21, 100], [99, 97]);
    const { rows } = await db.query<{ a: number; b: number; codice: string }>(
      `select c.a, c.b, valida_punteggio(c.a, c.b) as codice
       from jsonb_to_recordset($1::jsonb) as c(a integer, b integer)`,
      [JSON.stringify(casi.map(([a, b]) => ({ a, b })))],
    );
    for (const r of rows) {
      expect([r.a, r.b, r.codice]).toEqual([r.a, r.b, codiceErrore(r.a, r.b)]);
    }
  });
});

describe("salva_punteggio", () => {
  it("salva il set, conclude la partita e scrive nel registro", async () => {
    const { partite } = await avviata();
    const { rows } = await salva(partite[0], 1, 21, 19);
    expect(rows[0]).toEqual({ versione: 2, tipo: "inserimento_punteggio" });

    expect(await statoPartita(partite[0])).toEqual({
      stato: "conclusa",
      sets: [{ a: 21, b: 19 }],
      versione: 2,
    });
    expect(await eventi(partite[0])).toEqual([
      {
        tipo: "inserimento_punteggio",
        valore_prima: { sets: [], stato: "programmata", versione: 1 },
        valore_dopo: {
          sets: [{ a: 21, b: 19 }],
          stato: "conclusa",
          versione: 2,
        },
      },
    ]);
  });

  it("un secondo salvataggio è una correzione", async () => {
    const { partite } = await avviata();
    await salva(partite[0], 1, 21, 19);
    const { rows } = await salva(partite[0], 2, 19, 21);
    expect(rows[0]).toEqual({ versione: 3, tipo: "correzione_punteggio" });
  });

  it.each([
    [21, 21, "pareggio"],
    [21, 20, "regola_set"],
    [23, 20, "regola_set"],
    [-1, 21, "valori_non_validi"],
  ])("rifiuta %i–%i con hint %s", async (a, b, hint) => {
    const { partite } = await avviata();
    const e = await errore(salva(partite[0], 1, a, b));
    expect(e).toMatchObject({ code: "23514", hint });
    expect((await statoPartita(partite[0])).versione).toBe(1);
  });

  it("rifiuta una versione superata", async () => {
    const { partite } = await avviata();
    await salva(partite[0], 1, 21, 19);
    const e = await errore(salva(partite[0], 1, 21, 15));
    expect(e).toMatchObject({
      code: "40001",
      hint: "versione_superata",
      detail: "2",
    });
  });

  it("rifiuta una partita di una fase non avviata", async () => {
    const { girone, tabellone } = await tappaConGirone("in_corso");
    const { rows } = await db.query<{ id: string }>(
      `insert into partite (tabellone_id, girone_id, fase, turno, stato)
       values ($1, $2, 'gironi', 1, 'programmata') returning id`,
      [tabellone, girone],
    );
    const e = await errore(salva(rows[0].id, 1, 21, 19));
    expect(e).toMatchObject({ hint: "partita_non_giocabile" });
  });

  it("è riservato all'amministrazione", async () => {
    const { partite } = await avviata();
    const giocatore = await createAuthUser(db, { email: "g@example.it" });
    const e = await errore(
      asRole(db, "authenticated", giocatore, () =>
        db.query("select * from salva_punteggio($1, 1, 21, 19)", [partite[0]]),
      ),
    );
    expect(e.code).toBe("42501");
  });
});

describe("annulla_punteggio", () => {
  it("ripristina punteggio e stato di prima e lo registra", async () => {
    const { partite } = await avviata();
    await salva(partite[0], 1, 21, 19);
    const { rows } = await annulla(partite[0], 2);
    expect(rows[0].annulla_punteggio).toBe(3);

    expect(await statoPartita(partite[0])).toEqual({
      stato: "programmata",
      sets: [],
      versione: 3,
    });
    const registro = await eventi(partite[0]);
    expect(registro.map((r) => r.tipo)).toEqual([
      "inserimento_punteggio",
      "annullamento_punteggio",
    ]);
    expect(registro[1].valore_dopo).toEqual({
      sets: [],
      stato: "programmata",
      versione: 3,
    });
  });

  it("annullare una correzione rimette il punteggio precedente", async () => {
    const { partite } = await avviata();
    await salva(partite[0], 1, 21, 19);
    await salva(partite[0], 2, 22, 24);
    await annulla(partite[0], 3);
    expect(await statoPartita(partite[0])).toMatchObject({
      stato: "conclusa",
      sets: [{ a: 21, b: 19 }],
    });
  });

  it("rifiuta se il punteggio è cambiato o già annullato", async () => {
    const { partite } = await avviata();
    await salva(partite[0], 1, 21, 19);
    await salva(partite[0], 2, 21, 17);
    expect(await errore(annulla(partite[0], 2))).toMatchObject({
      code: "40001",
      hint: "punteggio_cambiato",
    });
    await annulla(partite[0], 3);
    expect(await errore(annulla(partite[0], 4))).toMatchObject({
      hint: "punteggio_cambiato",
    });
  });

  it("rifiuta oltre la finestra di annullamento", async () => {
    const { partite } = await avviata();
    await salva(partite[0], 1, 21, 19);
    // The registro is append-only: move the clock instead of the row.
    await db.query("alter table registro disable trigger user");
    await db.query(
      `update registro set created_at = now() - interval '5 minutes'
       where entita = 'punteggi' and entita_id = $1`,
      [partite[0]],
    );
    await db.query("alter table registro enable trigger user");
    expect(await errore(annulla(partite[0], 2))).toMatchObject({
      code: "23514",
      hint: "annullamento_scaduto",
    });
  });
});

describe("partite_punteggio_tappa", () => {
  it("elenca le partite dei gironi con le coppie", async () => {
    const { tappa, partite } = await avviata();
    const { rows } = await asAdmin(() =>
      db.query<{
        partita_id: string;
        turno: number;
        squadra_a: { cognome: string }[];
        squadra_b: { cognome: string }[];
      }>("select * from partite_punteggio_tappa($1)", [tappa]),
    );
    expect(rows.map((r) => r.partita_id)).toEqual(partite);
    expect(rows[0].squadra_a.map((g) => g.cognome)).toHaveLength(2);
    expect(rows[0].squadra_b.map((g) => g.cognome)).toHaveLength(2);
  });
});
