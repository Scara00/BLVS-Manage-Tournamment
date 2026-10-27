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

type PgError = { code?: string; hint?: string; detail?: string };

async function errore(promise: Promise<unknown>): Promise<PgError> {
  try {
    await promise;
  } catch (error) {
    return error as PgError;
  }
  throw new Error("expected an error");
}

/** A started group of 4 on the M board; returns its matches and board. */
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
  await asRole(db, "authenticated", admin, () =>
    db.query("select * from avvia_fase($1)", [tb[0].id]),
  );
  const { rows: p } = await db.query<{ id: string }>(
    "select id from partite where girone_id = $1 order by turno",
    [g[0].id],
  );
  return {
    tappa,
    tabellone: tb[0].id,
    partite: p.map((x) => x.id),
    iscrizioni,
  };
}

/** A next-phase match (BLVS-39 stand-in), with a score when `sets` given. */
async function partitaSuccessiva(
  tabellone: string,
  iscrizioni: string[],
  sets: { a: number; b: number }[] = [],
) {
  const { rows } = await db.query<{ id: string }>(
    `insert into partite (tabellone_id, fase, turno, stato)
     values ($1, 'finale', 1, $2) returning id`,
    [tabellone, sets.length ? "conclusa" : "programmata"],
  );
  const id = rows[0].id;
  for (const [i, iscrizione] of iscrizioni.entries()) {
    await db.query(
      "insert into partita_giocatori (partita_id, iscrizione_id, squadra) values ($1, $2, $3)",
      [id, iscrizione, i < 2 ? "A" : "B"],
    );
  }
  await db.query(
    "update punteggi set sets = $2, versione = versione + 1 where partita_id = $1",
    [id, JSON.stringify(sets)],
  );
  return id;
}

function salva(partita: string, versione: number, a: number, b: number) {
  return asRole(db, "authenticated", admin, () =>
    db.query("select * from salva_punteggio($1, $2, $3, $4)", [
      partita,
      versione,
      a,
      b,
    ]),
  );
}

function correggi(
  partita: string,
  versione: number,
  a: number,
  b: number,
  opzioni: { scelta?: string; conferma?: boolean; attesi?: number } = {},
) {
  return asRole(db, "authenticated", admin, () =>
    db.query<{
      versione: number;
      tipo: string;
      scelta: string | null;
      punteggi_persi: number;
    }>("select * from correggi_punteggio($1, $2, $3, $4, $5, $6, $7)", [
      partita,
      versione,
      a,
      b,
      opzioni.scelta ?? null,
      opzioni.conferma ?? false,
      opzioni.attesi ?? null,
    ]),
  );
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

async function contaSuccessive(tabellone: string) {
  const { rows } = await db.query<{ n: number }>(
    "select count(*) as n from partite where tabellone_id = $1 and fase <> 'gironi'",
    [tabellone],
  );
  return Number(rows[0].n);
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

describe("correggi_punteggio (BLVS-41)", () => {
  it("senza fase successiva corregge come salva_punteggio e conserva il valore precedente", async () => {
    const { partite } = await gironeAvviato();
    await salva(partite[0], 1, 21, 18);
    const { rows } = await correggi(partite[0], 2, 18, 21);
    expect(rows[0]).toMatchObject({
      versione: 3,
      tipo: "correzione_punteggio",
      scelta: null,
      punteggi_persi: 0,
    });
    const [, correzione] = await eventi(partite[0]);
    expect(correzione).toMatchObject({
      tipo: "correzione_punteggio",
      nota: null,
      valore_prima: { sets: [{ a: 21, b: 18 }], versione: 2 },
      valore_dopo: { sets: [{ a: 18, b: 21 }], versione: 3 },
    });
  });

  it("con la fase successiva chiede una scelta, senza scrivere", async () => {
    const { partite, tabellone, iscrizioni } = await gironeAvviato();
    await salva(partite[0], 1, 21, 18);
    await partitaSuccessiva(tabellone, iscrizioni, [{ a: 21, b: 15 }]);
    const e = await errore(correggi(partite[0], 2, 18, 21));
    expect(e).toMatchObject({
      code: "23514",
      hint: "impatto_richiesto",
      detail: "1",
    });
    expect(await eventi(partite[0])).toHaveLength(1);

    const { rows } = await asRole(db, "authenticated", admin, () =>
      db.query<{ fase: string; sets: unknown; squadra_a: string[] }>(
        "select * from fase_successiva_correzione($1)",
        [partite[0]],
      ),
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ fase: "finale", sets: [{ a: 21, b: 15 }] });
    expect(rows[0].squadra_a).toHaveLength(2);
  });

  it("«Mantieni» corregge e lascia la fase successiva, con la nota nel registro", async () => {
    const { partite, tabellone, iscrizioni } = await gironeAvviato();
    await salva(partite[0], 1, 21, 18);
    await partitaSuccessiva(tabellone, iscrizioni, [{ a: 21, b: 15 }]);
    const { rows } = await correggi(partite[0], 2, 18, 21, {
      scelta: "mantieni",
      attesi: 1,
    });
    expect(rows[0]).toMatchObject({ scelta: "mantieni", punteggi_persi: 0 });
    expect(await contaSuccessive(tabellone)).toBe(1);
    const [, correzione] = await eventi(partite[0]);
    expect(correzione.nota).toBe("Fase successiva mantenuta");
  });

  it("«Rigenera» senza spunta è rifiutato quando si perdono punteggi", async () => {
    const { partite, tabellone, iscrizioni } = await gironeAvviato();
    await salva(partite[0], 1, 21, 18);
    await partitaSuccessiva(tabellone, iscrizioni, [{ a: 21, b: 15 }]);
    const e = await errore(
      correggi(partite[0], 2, 18, 21, { scelta: "rigenera", attesi: 1 }),
    );
    expect(e).toMatchObject({ code: "23514", hint: "conferma_richiesta" });
    expect(await contaSuccessive(tabellone)).toBe(1);
  });

  it("«Rigenera» confermato elimina la fase successiva e scrive la rigenerazione", async () => {
    const { partite, tabellone, iscrizioni, tappa } = await gironeAvviato();
    await salva(partite[0], 1, 21, 18);
    await partitaSuccessiva(tabellone, iscrizioni, [{ a: 21, b: 15 }]);
    await partitaSuccessiva(tabellone, iscrizioni);
    const { rows } = await correggi(partite[0], 2, 18, 21, {
      scelta: "rigenera",
      conferma: true,
      attesi: 1,
    });
    expect(rows[0]).toMatchObject({ scelta: "rigenera", punteggi_persi: 1 });
    expect(await contaSuccessive(tabellone)).toBe(0);

    const [, correzione] = await eventi(partite[0]);
    expect(correzione.nota).toBe(
      "Fase successiva rigenerata con 1 punteggio perso",
    );
    const [rigenerazione] = await eventi(tabellone);
    expect(rigenerazione).toMatchObject({
      tipo: "rigenerazione_gironi",
      valore_prima: { tappa_id: tappa, partite: 2, punteggi_persi: 1 },
      valore_dopo: { tappa_id: tappa, partite: 0, correzione_di: partite[0] },
    });
  });

  it("i punteggi cambiati dopo il dialog fermano la correzione", async () => {
    const { partite, tabellone, iscrizioni } = await gironeAvviato();
    await salva(partite[0], 1, 21, 18);
    await partitaSuccessiva(tabellone, iscrizioni, [{ a: 21, b: 15 }]);
    const e = await errore(
      correggi(partite[0], 2, 18, 21, { scelta: "mantieni", attesi: 0 }),
    );
    expect(e).toMatchObject({
      code: "40001",
      hint: "punteggi_cambiati",
      detail: "1",
    });
  });

  it("valida come l'inserimento e rifiuta una versione superata", async () => {
    const { partite } = await gironeAvviato();
    await salva(partite[0], 1, 21, 18);
    expect(await errore(correggi(partite[0], 2, 21, 20))).toMatchObject({
      hint: "regola_set",
    });
    expect(await errore(correggi(partite[0], 1, 21, 15))).toMatchObject({
      code: "40001",
      hint: "versione_superata",
    });
  });

  it("solo l'amministrazione", async () => {
    const { partite } = await gironeAvviato();
    const giocatore = await createAuthUser(db, {
      email: `p-${crypto.randomUUID()}@example.it`,
    });
    const e = await errore(
      asRole(db, "authenticated", giocatore, () =>
        db.query("select * from correggi_punteggio($1, 1, 21, 18)", [
          partite[0],
        ]),
      ),
    );
    expect(e.code).toBe("42501");
  });
});
