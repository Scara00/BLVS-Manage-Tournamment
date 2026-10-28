// @vitest-environment node
import { beforeEach, describe, expect, it } from "vitest";
import {
  asRole,
  createAuthUser,
  createTestDatabase,
  type TestDatabase,
} from "@/test/pglite";
import { REGOLA_RITIRO } from "./regola";

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

function comeAdmin<T>(fn: () => Promise<T>) {
  return asRole(db, "authenticated", admin, fn);
}

/** A started group of 4 on the M board; its matches and players. */
async function gironeAvviato() {
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
  const iscrizioni: string[] = [];
  for (let i = 0; i < 4; i++) {
    const utente = await createAuthUser(db, {
      email: `g${i}-${crypto.randomUUID()}@example.it`,
    });
    await db.query("update utenti set nome = $2, cognome = $3 where id = $1", [
      utente,
      `Nome${i}`,
      `Cognome${i}`,
    ]);
    const { rows: isc } = await db.query<{ id: string }>(
      `insert into iscrizioni (tappa_id, tabellone_id, utente_id, stato)
       values ($1, $2, $3, 'confermata') returning id`,
      [tappa, tb[0].id, utente],
    );
    iscrizioni.push(isc[0].id);
    await db.query(
      "insert into girone_iscrizioni (girone_id, iscrizione_id) values ($1, $2)",
      [g[0].id, isc[0].id],
    );
  }
  await comeAdmin(() => db.query("select * from avvia_fase($1)", [tb[0].id]));
  const { rows: p } = await db.query<{ id: string }>(
    "select id from partite where girone_id = $1 order by turno",
    [g[0].id],
  );
  return {
    tappa,
    tabellone: tb[0].id,
    girone: g[0].id,
    partite: p.map((x) => x.id),
    iscrizioni,
  };
}

function salva(partita: string, versione: number, a: number, b: number) {
  return comeAdmin(() =>
    db.query("select * from salva_punteggio($1, $2, $3, $4)", [
      partita,
      versione,
      a,
      b,
    ]),
  );
}

function registra(
  iscrizione: string,
  tipo: string,
  partite: { partita_id: string; versione: number }[],
  opzioni: { scelta?: string; conferma?: boolean; attesi?: number } = {},
) {
  return comeAdmin(() =>
    db.query<{
      partite: number;
      scelta: string | null;
      punteggi_persi: number;
    }>("select * from registra_ritiro_assenza($1, $2, $3, $4, $5, $6)", [
      iscrizione,
      tipo,
      JSON.stringify(partite),
      opzioni.scelta ?? null,
      opzioni.conferma ?? false,
      opzioni.attesi ?? null,
    ]),
  );
}

async function partita(id: string) {
  const { rows } = await db.query<{
    stato: string;
    sets: { a: number; b: number }[];
    versione: number;
  }>(
    `select p.stato, pt.sets, pt.versione from partite p
     join punteggi pt on pt.partita_id = p.id where p.id = $1`,
    [id],
  );
  return rows[0];
}

async function eventi(entitaId: string) {
  const { rows } = await db.query<{
    tipo: string;
    nota: string | null;
    valore_prima: Record<string, unknown>;
    valore_dopo: Record<string, unknown>;
  }>(
    `select tipo, nota, valore_prima, valore_dopo from registro
     where entita_id = $1 and tipo is not null order by id`,
    [entitaId],
  );
  return rows;
}

beforeEach(async () => {
  db = await createTestDatabase();
  admin = await createAuthUser(db, {
    email: `admin-${crypto.randomUUID()}@example.it`,
  });
  await db.query(
    "update utenti set ruolo = 'admin', nome = 'Giulia', cognome = 'Neri' where id = $1",
    [admin],
  );
});

describe("regola_ritiro (Q-09)", () => {
  it("è la stessa regola di REGOLA_RITIRO", async () => {
    const { rows } = await db.query<{
      esito: string;
      punti_vincitore: number;
      punti_perdente: number;
    }>("select * from regola_ritiro()");
    expect(rows[0]).toEqual({
      esito: REGOLA_RITIRO.esito,
      punti_vincitore: REGOLA_RITIRO.puntiVincitore,
      punti_perdente: REGOLA_RITIRO.puntiPerdente,
    });
  });
});

describe("registra_ritiro_assenza (BLVS-42)", () => {
  it("annulla le partite scelte, anche una conclusa, e scrive il registro", async () => {
    const { partite, iscrizioni, tappa } = await gironeAvviato();
    await salva(partite[0], 1, 21, 18);
    const { rows } = await registra(iscrizioni[0], "ritiro", [
      { partita_id: partite[0], versione: 2 },
      { partita_id: partite[1], versione: 1 },
    ]);
    expect(rows[0]).toEqual({ partite: 2, scelta: null, punteggi_persi: 0 });

    expect(await partita(partite[0])).toEqual({
      stato: "annullata",
      sets: [],
      versione: 3,
    });
    expect(await partita(partite[1])).toMatchObject({
      stato: "annullata",
      versione: 1,
    });
    expect((await partita(partite[2])).stato).toBe("programmata");

    // The overwritten score is a correction, with the previous value.
    const [, correzione] = await eventi(partite[0]);
    expect(correzione).toMatchObject({
      tipo: "correzione_punteggio",
      nota: "Ritiro di Nome0 Cognome0",
      valore_prima: {
        sets: [{ a: 21, b: 18 }],
        stato: "conclusa",
        tappa_id: tappa,
      },
      valore_dopo: { sets: [], stato: "annullata", tappa_id: tappa },
    });
    expect(
      (await eventi(partite[1])).filter(
        (e) => e.tipo === "correzione_punteggio",
      ),
    ).toHaveLength(0);

    const [ritiro] = await eventi(iscrizioni[0]);
    expect(ritiro).toMatchObject({
      tipo: "ritiro",
      nota: "Ritiro di Nome0 Cognome0",
      valore_dopo: {
        tappa_id: tappa,
        giocatore: "Nome0 Cognome0",
        regola: { esito: "annulla" },
      },
    });
    expect(ritiro.valore_dopo.partite).toEqual([
      expect.objectContaining({
        partita_id: partite[0],
        girone: "Girone A",
        turno: 1,
        stato: "annullata",
      }),
      expect.objectContaining({
        partita_id: partite[1],
        turno: 2,
        stato: "annullata",
      }),
    ]);
    expect(ritiro.valore_prima.partite).toEqual([
      expect.objectContaining({ sets: [{ a: 21, b: 18 }], stato: "conclusa" }),
      expect.objectContaining({ sets: [], stato: "programmata" }),
    ]);

    // The registration is untouched (client decision).
    const { rows: isc } = await db.query<{ stato: string }>(
      "select stato from iscrizioni where id = $1",
      [iscrizioni[0]],
    );
    expect(isc[0].stato).toBe("confermata");
    const { rows: assenze } = await db.query<{ tipo: string; esito: string }>(
      "select tipo, esito from assenze_partita where iscrizione_id = $1",
      [iscrizioni[0]],
    );
    expect(assenze).toEqual([
      { tipo: "ritiro", esito: "annulla" },
      { tipo: "ritiro", esito: "annulla" },
    ]);
  });

  it("rifiuta le richieste non valide", async () => {
    const { partite, iscrizioni } = await gironeAvviato();
    const altro = await gironeAvviato();
    const casi: [Promise<unknown>, string][] = [
      [
        registra(iscrizioni[0], "squalifica", [
          { partita_id: partite[0], versione: 1 },
        ]),
        "tipo_non_valido",
      ],
      [registra(iscrizioni[0], "assenza", []), "partite_mancanti"],
      [
        registra(iscrizioni[0], "assenza", [
          { partita_id: altro.partite[0], versione: 1 },
        ]),
        "partita_estranea",
      ],
      [
        registra(iscrizioni[0], "assenza", [
          { partita_id: partite[0], versione: 1 },
          { partita_id: partite[0], versione: 1 },
        ]),
        "partita_estranea",
      ],
    ];
    for (const [promessa, hint] of casi) {
      expect(await errore(promessa)).toMatchObject({ code: "23514", hint });
    }

    expect(
      await errore(
        registra(iscrizioni[0], "assenza", [
          { partita_id: partite[0], versione: 5 },
        ]),
      ),
    ).toMatchObject({ code: "40001", hint: "punteggio_cambiato", detail: "1" });

    await registra(iscrizioni[0], "assenza", [
      { partita_id: partite[0], versione: 1 },
    ]);
    // Same player again: already recorded; another player: already voided.
    expect(
      await errore(
        registra(iscrizioni[0], "assenza", [
          { partita_id: partite[0], versione: 1 },
        ]),
      ),
    ).toMatchObject({ hint: "partita_annullata" });
    expect(
      await errore(
        registra(iscrizioni[1], "assenza", [
          { partita_id: partite[0], versione: 1 },
        ]),
      ),
    ).toMatchObject({ hint: "partita_annullata" });

    const e = await errore(
      asRole(db, "authenticated", iscrizioni[0], () =>
        db.query("select * from registra_ritiro_assenza($1, 'ritiro', '[]')", [
          iscrizioni[0],
        ]),
      ),
    );
    expect(e.code).toBe("42501");
  });

  it("solo a tappa in corso", async () => {
    const { partite, iscrizioni, tappa } = await gironeAvviato();
    await db.query("update tappe set stato = 'conclusa' where id = $1", [
      tappa,
    ]);
    expect(
      await errore(
        registra(iscrizioni[0], "assenza", [
          { partita_id: partite[0], versione: 1 },
        ]),
      ),
    ).toMatchObject({ hint: "tappa_non_in_corso" });
  });

  it("con i gironi gold/silver già avviati chiede una scelta e «Rigenera» li elimina", async () => {
    const { partite, iscrizioni, tabellone } = await gironeAvviato();
    for (const p of partite) await salva(p, 1, 21, 15);
    // A gold group with one match scored (BLVS-39 shape).
    const { rows: gold } = await db.query<{ id: string }>(
      `insert into gironi (tabellone_id, nome, posizione, fase)
       values ($1, 'Gold A', 2, 'gold') returning id`,
      [tabellone],
    );
    const { rows: pg } = await db.query<{ id: string }>(
      `insert into partite (tabellone_id, girone_id, fase, turno, stato)
       values ($1, $2, 'gironi', 1, 'conclusa') returning id`,
      [tabellone, gold[0].id],
    );
    await db.query(
      'update punteggi set sets = \'[{"a":21,"b":10}]\', versione = versione + 1 where partita_id = $1',
      [pg[0].id],
    );
    await db.query(
      "update tabelloni set fase_gioco = 'gironi_gold_silver' where id = $1",
      [tabellone],
    );

    const scelta = [{ partita_id: partite[2], versione: 2 }];
    expect(
      await errore(registra(iscrizioni[0], "assenza", scelta)),
    ).toMatchObject({
      code: "23514",
      hint: "impatto_richiesto",
      detail: "1",
    });
    const { rows: successive } = await comeAdmin(() =>
      db.query<{ girone: string; fase: string }>(
        "select * from fase_successiva_correzione($1)",
        [partite[2]],
      ),
    );
    expect(successive).toEqual([
      expect.objectContaining({ girone: "Gold A", fase: "gironi" }),
    ]);

    expect(
      await errore(
        registra(iscrizioni[0], "assenza", scelta, {
          scelta: "rigenera",
          attesi: 1,
        }),
      ),
    ).toMatchObject({ hint: "conferma_richiesta" });
    expect(
      await errore(
        registra(iscrizioni[0], "assenza", scelta, {
          scelta: "mantieni",
          attesi: 0,
        }),
      ),
    ).toMatchObject({ code: "40001", hint: "punteggi_cambiati" });

    const { rows } = await registra(iscrizioni[0], "assenza", scelta, {
      scelta: "rigenera",
      conferma: true,
      attesi: 1,
    });
    expect(rows[0]).toEqual({
      partite: 1,
      scelta: "rigenera",
      punteggi_persi: 1,
    });
    const { rows: rimasti } = await db.query<{ n: number }>(
      "select count(*) as n from gironi where tabellone_id = $1 and fase <> 'iniziale'",
      [tabellone],
    );
    expect(Number(rimasti[0].n)).toBe(0);
    const { rows: tb } = await db.query<{ fase_gioco: string }>(
      "select fase_gioco from tabelloni where id = $1",
      [tabellone],
    );
    expect(tb[0].fase_gioco).toBe("gironi_iniziali");
    const [assenza] = await eventi(iscrizioni[0]);
    expect(assenza.nota).toBe(
      "Assenza di Nome0 Cognome0 · Fase successiva rigenerata con 1 punteggio perso",
    );
    const [rigenerazione] = await eventi(tabellone);
    expect(rigenerazione).toMatchObject({ tipo: "rigenerazione_gironi" });
  });

  it("anche la correzione di un girone iniziale vede i gironi gold/silver", async () => {
    const { partite, tabellone } = await gironeAvviato();
    await salva(partite[0], 1, 21, 15);
    const { rows: gold } = await db.query<{ id: string }>(
      `insert into gironi (tabellone_id, nome, posizione, fase)
       values ($1, 'Gold A', 2, 'gold') returning id`,
      [tabellone],
    );
    await db.query(
      `insert into partite (tabellone_id, girone_id, fase, turno)
       values ($1, $2, 'gironi', 1)`,
      [tabellone, gold[0].id],
    );
    const e = await errore(
      comeAdmin(() =>
        db.query("select * from correggi_punteggio($1, 2, 18, 21)", [
          partite[0],
        ]),
      ),
    );
    expect(e).toMatchObject({ hint: "impatto_richiesto", detail: "0" });
    await comeAdmin(() =>
      db.query(
        "select * from correggi_punteggio($1, 2, 18, 21, 'rigenera', false, 0)",
        [partite[0]],
      ),
    );
    const { rows } = await db.query<{ n: number }>(
      "select count(*) as n from gironi where id = $1",
      [gold[0].id],
    );
    expect(Number(rows[0].n)).toBe(0);
  });
});
