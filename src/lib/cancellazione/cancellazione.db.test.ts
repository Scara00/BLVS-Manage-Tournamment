// @vitest-environment node
import { beforeEach, describe, expect, it } from "vitest";
import {
  classificaDaDati,
  classificaTappaDaDati,
  type DatiClassificaGenerale,
} from "@/lib/classifica-generale/dati";
import {
  asRole,
  createAuthUser,
  createTestDatabase,
  type TestDatabase,
} from "@/test/pglite";
import { NOME_ANONIMO } from "./anonimo";

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

async function tappa(stato: string, data: string) {
  const { rows } = await db.query<{ id: string }>(
    `insert into tappe (nome, luogo, data_inizio, data_fine, stato)
     values ($1, 'Spiaggia', $2, $2, $3::stato_tappa) returning id`,
    [`Tappa ${data}`, data, stato],
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
    email: `${cognome}-${crypto.randomUUID()}@example.it`,
    meta: { nome: "N", cognome, consenso_privacy: "1.0" },
  });
  return id;
}

async function iscrivi(tappaId: string, utente: string, stato = "confermata") {
  const { rows } = await db.query<{ id: string }>(
    `insert into iscrizioni (tappa_id, tabellone_id, utente_id, stato)
     values ($1, $2, $3, $4::stato_iscrizione) returning id`,
    [tappaId, await tabellone(tappaId), utente, stato],
  );
  return rows[0].id;
}

async function girone(tappaId: string, fase: string) {
  const { rows } = await db.query<{ id: string }>(
    `insert into gironi (tabellone_id, nome, posizione, fase)
     values ($1, $2, 1, $3) returning id`,
    [await tabellone(tappaId), `Girone ${fase}`, fase],
  );
  return rows[0].id;
}

async function partita(
  tappaId: string,
  gironeId: string,
  [a, b, c, d]: string[],
  sets: { a: number; b: number }[],
) {
  const { rows } = await db.query<{ id: string }>(
    `insert into partite (tabellone_id, girone_id, fase, stato)
     values ($1, $2, 'gironi', 'conclusa') returning id`,
    [await tabellone(tappaId), gironeId],
  );
  const id = rows[0].id;
  for (const [i, squadra] of [
    [a, "A"],
    [b, "A"],
    [c, "B"],
    [d, "B"],
  ]) {
    await db.query(
      "insert into partita_giocatori (partita_id, iscrizione_id, squadra) values ($1, $2, $3)",
      [id, i, squadra],
    );
  }
  await db.query(
    "update punteggi set sets = $2::jsonb, versione = versione + 1 where partita_id = $1",
    [id, JSON.stringify(sets)],
  );
  return id;
}

/**
 * A stage whose gold final the four players played in this order of points;
 * `concluso` closes its boards and the stage (an account is deleted only
 * with no stage in progress).
 */
async function tappaGiocata(
  data: string,
  giocatori: string[],
  concluso = false,
) {
  const id = await tappa("in_corso", data);
  const iscrizioni = [];
  for (const g of giocatori) iscrizioni.push(await iscrivi(id, g));
  const finale = await girone(id, "finale_gold");
  for (const i of iscrizioni) {
    await db.query(
      "insert into girone_iscrizioni (girone_id, iscrizione_id) values ($1, $2)",
      [finale, i],
    );
  }
  const [a, b, c, d] = iscrizioni;
  await partita(id, finale, [a, b, c, d], [{ a: 21, b: 15 }]);
  await partita(id, finale, [a, c, b, d], [{ a: 21, b: 18 }]);
  await partita(id, finale, [a, d, b, c], [{ a: 21, b: 19 }]);
  if (concluso) {
    await db.query(
      "update tabelloni set concluso_il = now() where tappa_id = $1",
      [id],
    );
    await db.query("update tappe set stato = 'conclusa' where id = $1", [id]);
  }
  return { id, iscrizioni };
}

async function dati(): Promise<DatiClassificaGenerale> {
  return asRole(db, "anon", null, async () => {
    const { rows } = await db.query<{ dati: DatiClassificaGenerale }>(
      "select classifica_generale_dati('M', 2026) as dati",
    );
    return rows[0].dati;
  });
}

function cancella(utente: string) {
  return asRole(db, "authenticated", utente, async () => {
    const { rows } = await db.query<{
      cancella_account: { tappe: string[]; ritirate: number };
    }>("select cancella_account()");
    return rows[0].cancella_account;
  });
}

beforeEach(async () => {
  db = await createTestDatabase();
  admin = await createAuthUser(db, { email: "admin@example.it" });
  await db.query("update utenti set ruolo = 'admin' where id = $1", [admin]);
});

async function conta(sql: string, params: unknown[]) {
  const { rows } = await db.query<{ n: number }>(sql, params);
  return Number(rows[0].n);
}

/** What is left of `utente` and of the given registrations. */
async function resti(utente: string, iscrizioni: string[]) {
  return {
    profilo: await conta("select count(*) as n from utenti where id = $1", [
      utente,
    ]),
    auth: await conta("select count(*) as n from auth.users where id = $1", [
      utente,
    ]),
    consensi: await conta(
      "select count(*) as n from consensi where utente_id = $1",
      [utente],
    ),
    iscrizioni: await conta(
      "select count(*) as n from iscrizioni where id = any($1::uuid[])",
      [iscrizioni],
    ),
    gironi: await conta(
      "select count(*) as n from girone_iscrizioni where iscrizione_id = any($1::uuid[])",
      [iscrizioni],
    ),
    partite: await conta(
      "select count(*) as n from partita_giocatori where iscrizione_id = any($1::uuid[])",
      [iscrizioni],
    ),
  };
}

const NIENTE = {
  profilo: 0,
  auth: 0,
  consensi: 0,
  iscrizioni: 0,
  gironi: 0,
  partite: 0,
};

/** Deletes the Auth user as the dashboard or the admin API do (no JWT). */
function eliminaDaAuth(utente: string) {
  return db.query("delete from auth.users where id = $1", [utente]);
}

describe("cancella_account: cancellazione definitiva", () => {
  it("il segnaposto SQL è ancora quello di GIOCATORE_ANONIMO", async () => {
    const { rows } = await db.query<{ nome: string; cognome: string }>(
      "select * from nome_anonimo()",
    );
    expect(rows[0]).toEqual(NOME_ANONIMO);
  });

  it("cancella profilo, utente Auth, consensi, iscrizioni giocate, gironi e partite", async () => {
    const giocatori = [];
    for (const c of ["Uno", "Due", "Tre", "Quattro"])
      giocatori.push(await giocatore(c));
    const [io, ...altri] = giocatori;
    const { iscrizioni } = await tappaGiocata("2026-06-01", giocatori, true);
    const partitePrima = await conta("select count(*) as n from partite", []);

    const esito = await cancella(io);
    expect(esito.tappe).toHaveLength(1);
    expect(esito.ritirate).toBe(0);

    expect(await resti(io, [iscrizioni[0]])).toEqual(NIENTE);
    // The matches stay for the other three players.
    expect(await conta("select count(*) as n from partite", [])).toBe(
      partitePrima,
    );
    expect(
      await conta(
        "select count(*) as n from partita_giocatori where iscrizione_id = any($1::uuid[])",
        [iscrizioni.slice(1)],
      ),
    ).toBe(9);
    for (const a of altri)
      expect(
        await conta("select count(*) as n from utenti where id = $1", [a]),
      ).toBe(1);
  });

  it("le classifiche si ricalcolano senza di lui", async () => {
    const giocatori = [];
    for (const c of ["Uno", "Due", "Tre", "Quattro"])
      giocatori.push(await giocatore(c));
    const [io] = giocatori;
    await tappaGiocata("2026-06-01", giocatori, true);

    await cancella(io);

    const d = await dati();
    const generale = classificaDaDati(d, "M", 2026).righe;
    expect(generale.map((r) => r.utenteId)).not.toContain(io);
    expect(generale).toHaveLength(3);
    for (const t of d.tappe) {
      const { iscrizioni, classifica } = classificaTappaDaDati(d, t.id);
      expect(iscrizioni.map((i) => i.utente_id)).not.toContain(io);
      expect(classifica.righe).toHaveLength(3);
    }
  });

  it("anche dalle tappe archiviate, che per il resto restano bloccate", async () => {
    const giocatori = [];
    for (const c of ["Uno", "Due", "Tre", "Quattro"])
      giocatori.push(await giocatore(c));
    const [io] = giocatori;
    const { id, iscrizioni } = await tappaGiocata(
      "2026-06-01",
      giocatori,
      true,
    );
    await db.query("update tappe set stato = 'archiviata' where id = $1", [id]);

    await cancella(io);
    expect(await resti(io, [iscrizioni[0]])).toEqual(NIENTE);

    // The bypass ends with the deletion.
    const e = await errore(
      db.query("delete from iscrizioni where id = $1", [iscrizioni[1]]),
    );
    expect(e.hint).toBe("tappa_archiviata");
  });

  it("nelle tappe non iniziate libera il posto e alza la versione dei gironi", async () => {
    const io = await giocatore("Uno");
    const aperta = await tappa("iscrizioni_aperte", "2026-08-01");
    const chiusa = await tappa("iscrizioni_chiuse", "2026-08-15");
    const iscrizioneAperta = await iscrivi(aperta, io);
    const iscrizioneChiusa = await iscrivi(chiusa, io);
    const g = await girone(chiusa, "iniziale");
    await db.query(
      "insert into girone_iscrizioni (girone_id, iscrizione_id) values ($1, $2)",
      [g, iscrizioneChiusa],
    );
    const versione = async () =>
      (
        await db.query<{ versione_gironi: number }>(
          "select versione_gironi from tabelloni where id = $1",
          [await tabellone(chiusa)],
        )
      ).rows[0].versione_gironi;
    const versionePrima = await versione();

    expect(await cancella(io)).toEqual({ tappe: [], ritirate: 2 });
    expect(await resti(io, [iscrizioneAperta, iscrizioneChiusa])).toEqual(
      NIENTE,
    );
    expect(await versione()).toBe(versionePrima + 1);
  });

  it("scrive nel registro la cancellazione, senza dati personali", async () => {
    const io = await giocatore("Uno");
    await cancella(io);
    const { rows } = await db.query<{
      azione: string;
      attore_id: string;
      dati: unknown;
    }>(
      "select azione, attore_id, dati from registro where entita = 'utenti' and entita_id = $1",
      [io],
    );
    expect(rows).toEqual([
      {
        azione: "eliminazione_account",
        attore_id: io,
        dati: { eliminato: true },
      },
    ]);
  });

  it("si cancella solo il proprio account, una volta sola", async () => {
    const io = await giocatore("Uno");
    expect(
      (
        await errore(
          asRole(db, "anon", null, () => db.query("select cancella_account()")),
        )
      ).code,
    ).toBe("42501");
    await cancella(io);
    // The JWT of a deleted account still names the old id until it expires.
    expect((await errore(cancella(io))).hint).toBe("gia_cancellato");
  });

  it("un admin non si cancella da qui, neanche con un altro admin", async () => {
    const altro = await createAuthUser(db, { email: "admin2@example.it" });
    await db.query("update utenti set ruolo = 'admin' where id = $1", [altro]);
    expect((await errore(cancella(admin))).hint).toBe("account_admin");
    expect(
      await conta("select count(*) as n from utenti where id = $1", [admin]),
    ).toBe(1);
  });
});

describe("eliminazione dell'utente Auth (dashboard, API admin)", () => {
  it("cancella anche il profilo e tutto ciò che è suo, tappe concluse comprese", async () => {
    const giocatori = [];
    for (const c of ["Uno", "Due", "Tre", "Quattro"])
      giocatori.push(await giocatore(c));
    const [io] = giocatori;
    const { iscrizioni } = await tappaGiocata("2026-06-01", giocatori, true);

    await eliminaDaAuth(io);
    expect(await resti(io, [iscrizioni[0]])).toEqual(NIENTE);
  });

  it("un admin eliminato: i punteggi che ha scritto restano, senza autore", async () => {
    const giocatori = [];
    for (const c of ["Uno", "Due", "Tre", "Quattro"])
      giocatori.push(await giocatore(c));
    const { id } = await tappaGiocata("2026-06-01", giocatori, true);
    const { rows: prima } = await db.query<{
      partita_id: string;
      sets: unknown;
      versione: number;
    }>(
      `select pu.partita_id, pu.sets, pu.versione from punteggi pu
       join partite p on p.id = pu.partita_id
       join tabelloni tb on tb.id = p.tabellone_id
       where tb.tappa_id = $1 order by pu.partita_id`,
      [id],
    );
    await db.query(
      "update punteggi set aggiornato_da = $1, versione = versione + 1 where partita_id = any($2::uuid[])",
      [admin, prima.map((r) => r.partita_id)],
    );

    await eliminaDaAuth(admin);

    const { rows: dopo } = await db.query<{
      sets: unknown;
      versione: number;
      aggiornato_da: string | null;
    }>(
      "select sets, versione, aggiornato_da from punteggi where partita_id = any($1::uuid[]) order by partita_id",
      [prima.map((r) => r.partita_id)],
    );
    expect(dopo).toEqual(
      prima.map((r) => ({
        sets: r.sets,
        versione: r.versione + 1,
        aggiornato_da: null,
      })),
    );
  });
});

describe("profili «mezzi cancellati»", () => {
  it("nessuno segna un profilo come cancellato, neanche dal SQL della dashboard", async () => {
    const io = await giocatore("Uno");
    const giocatoreStesso = await errore(
      asRole(db, "authenticated", io, () =>
        db.query("update utenti set anonimizzato_il = now() where id = $1", [
          io,
        ]),
      ),
    );
    expect(giocatoreStesso.code).toBe("42501");
    // No JWT (dashboard SQL editor, scripts): the check constraint.
    const backend = await errore(
      db.query("update utenti set anonimizzato_il = now() where id = $1", [io]),
    );
    expect(backend.code).toBe("23514");
  });

  it("un profilo esiste solo con il suo utente Auth", async () => {
    const e = await errore(
      db.query(
        "insert into utenti (id, email, nome, cognome) values ($1, 'x@example.it', 'X', 'Y')",
        [crypto.randomUUID()],
      ),
    );
    expect(e.code).toBe("23503");
  });
});
