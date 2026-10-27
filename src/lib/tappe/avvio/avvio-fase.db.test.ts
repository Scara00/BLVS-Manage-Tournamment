// @vitest-environment node
import { beforeEach, describe, expect, it } from "vitest";
import {
  asRole,
  createAuthUser,
  createTestDatabase,
  type TestDatabase,
} from "@/test/pglite";
import { REGOLA_AVVIO } from "./regole";

let db: TestDatabase;
let admin: string;

type PgError = { code?: string; hint?: string; detail?: string };

async function createStage(stato = "iscrizioni_chiuse") {
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
  return { tappa, tabellone: tb[0].id };
}

/** `n` confirmed players on the board; returns their registration ids. */
async function iscrivi(tappa: string, tabellone: string, n: number) {
  const ids: string[] = [];
  for (let k = 0; k < n; k++) {
    const utente = await createAuthUser(db, {
      email: `g${k}-${crypto.randomUUID()}@example.it`,
    });
    await db.query("update utenti set cognome = $2, nome = 'N' where id = $1", [
      utente,
      `Cognome${String(k).padStart(2, "0")}`,
    ]);
    const { rows } = await db.query<{ id: string }>(
      `insert into iscrizioni (tappa_id, tabellone_id, utente_id, stato)
       values ($1, $2, $3, 'confermata') returning id`,
      [tappa, tabellone, utente],
    );
    ids.push(rows[0].id);
  }
  return ids;
}

async function girone(tabellone: string, nome: string, iscrizioni: string[]) {
  const { rows } = await db.query<{ id: string }>(
    `insert into gironi (tabellone_id, nome, posizione)
     values ($1, $2, (select count(*) + 1 from gironi where tabellone_id = $1))
     returning id`,
    [tabellone, nome],
  );
  for (const i of iscrizioni) {
    await db.query(
      "insert into girone_iscrizioni (girone_id, iscrizione_id) values ($1, $2)",
      [rows[0].id, i],
    );
  }
  return rows[0].id;
}

function asAdmin<T>(fn: () => Promise<T>) {
  return asRole(db, "authenticated", admin, fn);
}

function avvia(tabellone: string) {
  return db.query<{ partita_id: string; turno: number }>(
    "select * from avvia_fase($1)",
    [tabellone],
  );
}

async function errore(promise: Promise<unknown>): Promise<PgError> {
  try {
    await promise;
  } catch (error) {
    return error as PgError;
  }
  throw new Error("expected an error");
}

beforeEach(async () => {
  db = await createTestDatabase();
  admin = await createAuthUser(db, { email: "admin@example.it" });
  await db.query("update utenti set ruolo = 'admin' where id = $1", [admin]);
});

describe("controlli di avvio", () => {
  it("la regola SQL è la stessa di REGOLA_AVVIO", async () => {
    const { rows } = await db.query<{
      dimensione: number;
      ammetti_resto: boolean;
    }>("select * from regola_avvio()");
    expect(rows[0]).toEqual({
      dimensione: REGOLA_AVVIO.dimensione,
      ammetti_resto: REGOLA_AVVIO.ammettiResto,
    });
  });

  it("rifiuta un girone che non è da 4, con il girone nel dettaglio", async () => {
    const { tappa, tabellone } = await createStage();
    const ids = await iscrivi(tappa, tabellone, 7);
    await girone(tabellone, "Girone A", ids.slice(0, 4));
    const b = await girone(tabellone, "Girone B", ids.slice(4));

    const e = await errore(asAdmin(() => avvia(tabellone)));
    expect(e.code).toBe("23514");
    expect(e.hint).toBe("avvio_bloccato");
    expect(JSON.parse(e.detail!)).toEqual([
      {
        regola: "girone_non_da_4",
        girone_id: b,
        girone_nome: "Girone B",
        dettaglio: "3",
      },
    ]);
  });

  it("conta solo i giocatori confermati del girone", async () => {
    const { tappa, tabellone } = await createStage();
    const ids = await iscrivi(tappa, tabellone, 4);
    await girone(tabellone, "Girone A", ids);
    await db.query("update iscrizioni set stato = 'ritirata' where id = $1", [
      ids[0],
    ]);
    const { rows } = await asAdmin(() =>
      db.query<{ regola: string }>("select * from controlli_avvio_fase($1)", [
        tabellone,
      ]),
    );
    expect(rows.map((r) => r.regola)).toEqual(["girone_non_da_4"]);
  });

  it("rifiuta gli iscritti confermati non assegnati", async () => {
    const { tappa, tabellone } = await createStage();
    const ids = await iscrivi(tappa, tabellone, 5);
    await girone(tabellone, "Girone A", ids.slice(0, 4));

    const e = await errore(asAdmin(() => avvia(tabellone)));
    expect(e.hint).toBe("avvio_bloccato");
    expect(JSON.parse(e.detail!)).toEqual([
      {
        regola: "non_assegnato",
        girone_id: null,
        girone_nome: null,
        dettaglio: "Cognome04 N",
      },
    ]);
  });

  it("rifiuta un tabellone senza gironi", async () => {
    const { tabellone } = await createStage();
    const e = await errore(asAdmin(() => avvia(tabellone)));
    expect(e.hint).toBe("avvio_bloccato");
    expect(JSON.parse(e.detail!)[0].regola).toBe("nessun_girone");
  });

  it("segnala i doppioni in ogni girone che li contiene", async () => {
    // girone_iscrizioni allows one group per registration, so a duplicate
    // can only be the same player through two registrations of the board:
    // simulated here by dropping the uniqueness for the test.
    const { tappa, tabellone } = await createStage();
    const ids = await iscrivi(tappa, tabellone, 8);
    const a = await girone(tabellone, "Girone A", ids.slice(0, 4));
    const b = await girone(tabellone, "Girone B", ids.slice(4));
    await db.exec(
      "alter table girone_iscrizioni drop constraint girone_iscrizioni_iscrizione_key",
    );
    await db.query("delete from girone_iscrizioni where iscrizione_id = $1", [
      ids[7],
    ]);
    await db.query(
      "insert into girone_iscrizioni (girone_id, iscrizione_id) values ($1, $2)",
      [b, ids[0]],
    );
    const { rows } = await asAdmin(() =>
      db.query<{ regola: string; girone_id: string }>(
        "select * from controlli_avvio_fase($1)",
        [tabellone],
      ),
    );
    const doppioni = rows.filter((r) => r.regola === "doppione");
    expect(doppioni.map((r) => r.girone_id)).toEqual([a, b]);
  });

  it("solo l'admin legge i controlli e avvia", async () => {
    const { tabellone } = await createStage();
    const giocatore = await createAuthUser(db, { email: "p@example.it" });
    const e = await errore(
      asRole(db, "authenticated", giocatore, () => avvia(tabellone)),
    );
    expect(e.code).toBe("42501");
  });
});

describe("avvio della fase", () => {
  it("crea 3 partite da giocare per girone, avvia la fase e la tappa", async () => {
    const { tappa, tabellone } = await createStage();
    const ids = await iscrivi(tappa, tabellone, 8);
    await girone(tabellone, "Girone A", ids.slice(0, 4));
    await girone(tabellone, "Girone B", ids.slice(4));

    const { rows } = await asAdmin(() => avvia(tabellone));
    expect(rows.map((r) => r.turno)).toEqual([1, 2, 3, 1, 2, 3]);

    const { rows: partite } = await db.query<{
      stato: string;
      fase: string;
      giocatori: number;
    }>(
      `select p.stato, p.fase, count(pg.*)::int as giocatori
       from partite p join partita_giocatori pg on pg.partita_id = p.id
       where p.tabellone_id = $1 group by p.id`,
      [tabellone],
    );
    expect(partite).toHaveLength(6);
    for (const p of partite) {
      expect(p).toEqual({ stato: "programmata", fase: "gironi", giocatori: 4 });
    }

    // Turno 2 of group A: A+C against B+D.
    const { rows: squadre } = await db.query<{
      cognome: string;
      squadra: string;
    }>(
      `select u.cognome, pg.squadra
       from partite p
       join gironi g on g.id = p.girone_id
       join partita_giocatori pg on pg.partita_id = p.id
       join iscrizioni i on i.id = pg.iscrizione_id
       join utenti u on u.id = i.utente_id
       where p.tabellone_id = $1 and g.nome = 'Girone A' and p.turno = 2
       order by u.cognome`,
      [tabellone],
    );
    expect(squadre).toEqual([
      { cognome: "Cognome00", squadra: "A" },
      { cognome: "Cognome01", squadra: "B" },
      { cognome: "Cognome02", squadra: "A" },
      { cognome: "Cognome03", squadra: "B" },
    ]);

    const { rows: stato } = await db.query<{
      fase_gioco: string;
      fase_avviata_il: Date | null;
      stato: string;
    }>(
      `select tb.fase_gioco, tb.fase_avviata_il, t.stato
       from tabelloni tb join tappe t on t.id = tb.tappa_id where tb.id = $1`,
      [tabellone],
    );
    expect(stato[0].fase_gioco).toBe("gironi_iniziali");
    expect(stato[0].fase_avviata_il).not.toBeNull();
    expect(stato[0].stato).toBe("in_corso");
  });

  it("sostituisce le partite di un sorteggio precedente", async () => {
    const { tappa, tabellone } = await createStage();
    const ids = await iscrivi(tappa, tabellone, 4);
    const a = await girone(tabellone, "Girone A", ids);
    await db.query(
      "insert into partite (tabellone_id, girone_id, fase, turno) values ($1, $2, 'gironi', 1)",
      [tabellone, a],
    );
    await asAdmin(() => avvia(tabellone));
    const { rows } = await db.query<{ n: number }>(
      "select count(*)::int as n from partite where tabellone_id = $1",
      [tabellone],
    );
    expect(rows[0].n).toBe(3);
  });

  it("non riavvia una fase già avviata", async () => {
    const { tappa, tabellone } = await createStage();
    await girone(tabellone, "Girone A", await iscrivi(tappa, tabellone, 4));
    await asAdmin(() => avvia(tabellone));
    const e = await errore(asAdmin(() => avvia(tabellone)));
    expect(e.hint).toBe("fase_gia_avviata");
  });

  it("parte solo a iscrizioni chiuse o con la tappa in corso", async () => {
    const { tappa, tabellone } = await createStage("iscrizioni_aperte");
    await girone(tabellone, "Girone A", await iscrivi(tappa, tabellone, 4));
    const e = await errore(asAdmin(() => avvia(tabellone)));
    expect(e.hint).toBe("tappa_non_avviabile");
  });

  it("avvia il secondo tabellone con la tappa già in corso", async () => {
    const { tappa, tabellone } = await createStage("in_corso");
    await girone(tabellone, "Girone A", await iscrivi(tappa, tabellone, 4));
    const { rows } = await asAdmin(() => avvia(tabellone));
    expect(rows).toHaveLength(3);
  });
});
