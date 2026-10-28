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
import { GIOCATORE_ANONIMO, NOME_ANONIMO } from "./anonimo";

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

/** Everything a standing shows except the name, per player. */
function senzaNomi(d: DatiClassificaGenerale) {
  const generale = classificaDaDati(d, "M", 2026).righe.map((r) => ({
    utenteId: r.utenteId,
    posizione: r.posizione,
    punti: r.punti,
    tappeGiocate: r.tappeGiocate,
    puntiProvvisori: r.puntiProvvisori,
    pariMerito: r.pariMerito,
  }));
  const tappe = d.tappe.map((t) =>
    classificaTappaDaDati(d, t.id).classifica.righe.map((r) => ({
      iscrizioneId: r.iscrizioneId,
      posizione: r.posizione,
      punti: r.punti,
    })),
  );
  const ordina = <T extends { utenteId: string }>(rows: T[]) =>
    [...rows].sort((a, b) => a.utenteId.localeCompare(b.utenteId));
  return { generale: ordina(generale), tappe };
}

beforeEach(async () => {
  db = await createTestDatabase();
  admin = await createAuthUser(db, { email: "admin@example.it" });
  await db.query("update utenti set ruolo = 'admin' where id = $1", [admin]);
});

describe("cancella_account", () => {
  it("il segnaposto SQL è quello di GIOCATORE_ANONIMO", async () => {
    const { rows } = await db.query<{ nome: string; cognome: string }>(
      "select * from nome_anonimo()",
    );
    expect(rows[0]).toEqual(NOME_ANONIMO);
  });

  it("classifica generale e classifiche di tappa non cambiano, solo il nome", async () => {
    const giocatori = [];
    for (const c of ["Uno", "Due", "Tre", "Quattro"])
      giocatori.push(await giocatore(c));
    const [io] = giocatori;
    await tappaGiocata("2026-06-01", giocatori, true);
    // Second stage: «io» finishes 3rd.
    await tappaGiocata(
      "2026-07-01",
      [giocatori[1], giocatori[2], io, giocatori[3]],
      true,
    );

    const prima = await dati();
    const rigaPrima = classificaDaDati(prima, "M", 2026).righe.find(
      (r) => r.utenteId === io,
    );
    expect(rigaPrima?.nome).toBe("N Uno");

    const esito = await cancella(io);
    // Both stages are in season 2026: one is enough to republish it.
    expect(esito.tappe).toHaveLength(1);
    expect(esito.ritirate).toBe(0);

    const dopo = await dati();
    expect(senzaNomi(dopo)).toEqual(senzaNomi(prima));
    const rigaDopo = classificaDaDati(dopo, "M", 2026).righe.find(
      (r) => r.utenteId === io,
    );
    expect(rigaDopo).toMatchObject({
      nome: GIOCATORE_ANONIMO,
      posizione: rigaPrima!.posizione,
      punti: rigaPrima!.punti,
    });
    // Each stage standing shows the anonymous name too.
    for (const t of dopo.tappe) {
      const { iscrizioni } = classificaTappaDaDati(dopo, t.id);
      const mia = iscrizioni.find((i) => i.utente_id === io);
      expect(`${mia?.nome} ${mia?.cognome}`).toBe(GIOCATORE_ANONIMO);
    }
  });

  it("elimina nome, email, utente Auth e consensi; i risultati restano", async () => {
    const giocatori = [];
    for (const c of ["Uno", "Due", "Tre", "Quattro"])
      giocatori.push(await giocatore(c));
    const [io] = giocatori;
    const { iscrizioni } = await tappaGiocata("2026-06-01", giocatori, true);
    const conta = async (sql: string) =>
      Number((await db.query<{ n: number }>(sql, [iscrizioni[0]])).rows[0].n);
    const risultati = () =>
      Promise.all([
        conta("select count(*) as n from iscrizioni where id = $1"),
        conta(
          "select count(*) as n from partita_giocatori where iscrizione_id = $1",
        ),
        conta(
          "select count(*) as n from girone_iscrizioni where iscrizione_id = $1",
        ),
      ]);
    const primaRisultati = await risultati();
    expect(
      (await db.query("select 1 from consensi where utente_id = $1", [io]))
        .rows,
    ).toHaveLength(1);

    await cancella(io);

    const { rows } = await db.query<{
      nome: string;
      cognome: string;
      email: string | null;
      ruolo: string;
      anonimizzato_il: Date | null;
    }>(
      "select nome, cognome, email, ruolo, anonimizzato_il from utenti where id = $1",
      [io],
    );
    expect(rows[0]).toMatchObject({
      ...NOME_ANONIMO,
      email: null,
      ruolo: "giocatore",
    });
    expect(rows[0].anonimizzato_il).not.toBeNull();
    expect(
      (await db.query("select 1 from auth.users where id = $1", [io])).rows,
    ).toHaveLength(0);
    expect(
      (await db.query("select 1 from consensi where utente_id = $1", [io]))
        .rows,
    ).toHaveLength(0);
    expect(await risultati()).toEqual(primaRisultati);
    // Nothing personal is copied into the registro by the anonymisation.
    const registro = await db.query<{ dati: unknown }>(
      "select dati from registro where entita = 'utenti' and entita_id = $1",
      [io],
    );
    expect(JSON.stringify(registro.rows)).not.toContain("@example.it");
  });

  it("ritira le iscrizioni delle tappe non iniziate e libera il girone", async () => {
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

    const esito = await cancella(io);
    expect(esito).toEqual({ tappe: [], ritirate: 2 });

    const { rows } = await db.query<{ stato: string }>(
      "select stato from iscrizioni where id = any($1::uuid[]) order by id",
      [[iscrizioneAperta, iscrizioneChiusa]],
    );
    expect(rows.map((r) => r.stato)).toEqual(["ritirata", "ritirata"]);
    expect(
      (
        await db.query(
          "select 1 from girone_iscrizioni where iscrizione_id = $1",
          [iscrizioneChiusa],
        )
      ).rows,
    ).toHaveLength(0);
    expect(await versione()).toBe(versionePrima + 1);
  });

  it("un account cancellato non si iscrive più, neanche da admin", async () => {
    const io = await giocatore("Uno");
    const aperta = await tappa("iscrizioni_aperte", "2026-08-01");
    await cancella(io);
    const e = await errore(
      asRole(db, "authenticated", admin, () =>
        db.query("select admin_iscrivi_giocatore($1, $2)", [aperta, io]),
      ),
    );
    expect(e.hint).toBe("giocatore_non_trovato");
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

  it("nessuno anonimizza un account scrivendo su utenti", async () => {
    const io = await giocatore("Uno");
    const e = await errore(
      asRole(db, "authenticated", io, () =>
        db.query("update utenti set anonimizzato_il = now() where id = $1", [
          io,
        ]),
      ),
    );
    expect(e.code).toBe("42501");
  });

  it("un admin non si cancella da qui, neanche con un altro admin", async () => {
    const altro = await createAuthUser(db, { email: "admin2@example.it" });
    await db.query("update utenti set ruolo = 'admin' where id = $1", [altro]);
    expect((await errore(cancella(admin))).hint).toBe("account_admin");
    const { rows } = await db.query<{ anonimizzato_il: Date | null }>(
      "select anonimizzato_il from utenti where id = $1",
      [admin],
    );
    expect(rows[0].anonimizzato_il).toBeNull();
  });
});
