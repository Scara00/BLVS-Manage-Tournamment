// @vitest-environment node
import { beforeEach, describe, expect, it } from "vitest";
import {
  asRole,
  createAuthUser,
  createTestDatabase,
  type TestDatabase,
} from "@/test/pglite";
import type { GironiGenerati } from "./types";

let db: TestDatabase;
let admin: string;

async function createStage(stato = "iscrizioni_chiuse") {
  const { rows } = await db.query<{ id: string }>(
    `insert into tappe (nome, luogo, data_inizio, data_fine, stato)
     values ('Tappa test', 'Spiaggia', '2099-07-01', '2099-07-02', $1::stato_tappa)
     returning id`,
    [stato],
  );
  return rows[0].id;
}

async function register(
  tappaId: string,
  categoria: "M" | "F",
  stato = "confermata",
) {
  const utente = await createAuthUser(db, {
    email: `${crypto.randomUUID()}@example.it`,
    categoria,
  });
  const { rows } = await db.query<{ id: string }>(
    `insert into iscrizioni (tappa_id, tabellone_id, utente_id, stato)
     select $1, id, $2, $3::stato_iscrizione from tabelloni
     where tappa_id = $1 and categoria = $4::categoria
     returning id`,
    [tappaId, utente, stato, categoria],
  );
  return rows[0].id;
}

function genera(tappaId: string, sub: string = admin) {
  return asRole(db, "authenticated", sub, () =>
    db.query<GironiGenerati>(
      "select * from genera_gironi($1) order by categoria",
      [tappaId],
    ),
  );
}

async function errore(promise: Promise<unknown>) {
  try {
    await promise;
  } catch (error) {
    return error as { code?: string; hint?: string };
  }
  throw new Error("La chiamata doveva fallire");
}

type Riga = {
  girone: string;
  nome: string;
  categoria: string;
  partita: string;
  turno: number;
  iscrizione: string;
  squadra: "A" | "B";
};

async function partite(tappaId: string) {
  const { rows } = await db.query<Riga>(
    `select g.id as girone, g.nome, tb.categoria, p.id as partita, p.turno,
            pg.iscrizione_id as iscrizione, pg.squadra
     from gironi g
     join tabelloni tb on tb.id = g.tabellone_id
     join partite p on p.girone_id = g.id
     join partita_giocatori pg on pg.partita_id = p.id
     where tb.tappa_id = $1
     order by g.posizione, p.turno`,
    [tappaId],
  );
  return rows;
}

beforeEach(async () => {
  db = await createTestDatabase();
  admin = await createAuthUser(db, { email: "admin@example.it" });
  await db.query("update utenti set ruolo = 'admin' where id = $1", [admin]);
});

describe("genera_gironi", () => {
  it("gironi da 4 per categoria con 3 partite, esclusi segnalati", async () => {
    const tappa = await createStage();
    const maschi = [];
    for (let i = 0; i < 9; i++) maschi.push(await register(tappa, "M"));
    const femmine = [];
    for (let i = 0; i < 4; i++) femmine.push(await register(tappa, "F"));
    // Fuori dal sorteggio: non confermate.
    const inAttesa = await register(tappa, "F", "in_attesa");
    const rifiutata = await register(tappa, "M", "rifiutata");

    const { rows } = await genera(tappa);
    expect(
      rows.map(({ categoria, gironi, partite }) => ({
        categoria,
        gironi,
        partite,
      })),
    ).toEqual([
      { categoria: "M", gironi: 2, partite: 6 },
      { categoria: "F", gironi: 1, partite: 3 },
    ]);
    const [m, f] = rows;
    expect(f.esclusi).toEqual([]);
    expect(m.esclusi).toHaveLength(1);
    expect(maschi).toContain(m.esclusi[0].iscrizione_id);

    const righe = await partite(tappa);
    const inGirone = new Map<string, string>();
    for (const r of righe) {
      const girone = inGirone.get(r.iscrizione);
      if (girone) expect(girone).toBe(r.girone);
      inGirone.set(r.iscrizione, r.girone);
    }
    // Nessuno in due gironi, l'escluso e i non confermati in nessuno.
    expect(inGirone.size).toBe(12);
    for (const id of [m.esclusi[0].iscrizione_id, inAttesa, rifiutata])
      expect(inGirone.has(id)).toBe(false);
    expect(new Set(righe.map((r) => r.nome))).toEqual(
      new Set(["Girone A", "Girone B"]),
    );

    const { rows: membri } = await db.query<{ n: number }>(
      `select count(*)::int as n from girone_iscrizioni gi
       join gironi g on g.id = gi.girone_id
       join tabelloni tb on tb.id = g.tabellone_id where tb.tappa_id = $1`,
      [tappa],
    );
    expect(membri[0].n).toBe(12);
    const { rows: punteggi } = await db.query<{ n: number }>(
      `select count(*)::int as n from punteggi pt
       join partite p on p.id = pt.partita_id
       join tabelloni tb on tb.id = p.tabellone_id where tb.tappa_id = $1`,
      [tappa],
    );
    expect(punteggi[0].n).toBe(9);
  });

  it("ognuno fa coppia una volta con ciascuno e lo affronta due volte", async () => {
    const tappa = await createStage();
    for (let i = 0; i < 8; i++) await register(tappa, "M");
    await genera(tappa);

    const perPartita = new Map<string, Riga[]>();
    for (const r of await partite(tappa))
      perPartita.set(r.partita, [...(perPartita.get(r.partita) ?? []), r]);
    const compagni = new Map<string, number>();
    const avversari = new Map<string, number>();
    const add = (m: Map<string, number>, a: string, b: string) =>
      m.set(`${a}|${b}`, (m.get(`${a}|${b}`) ?? 0) + 1);
    for (const giocatori of perPartita.values()) {
      expect(giocatori).toHaveLength(4);
      for (const a of giocatori)
        for (const b of giocatori)
          if (a !== b)
            add(
              a.squadra === b.squadra ? compagni : avversari,
              a.iscrizione,
              b.iscrizione,
            );
    }
    const perGirone = new Map<string, Set<string>>();
    for (const giocatori of perPartita.values())
      for (const g of giocatori)
        perGirone.set(
          g.girone,
          (perGirone.get(g.girone) ?? new Set()).add(g.iscrizione),
        );
    expect(perGirone.size).toBe(2);
    for (const membri of perGirone.values()) {
      expect(membri.size).toBe(4);
      for (const a of membri)
        for (const b of membri)
          if (a !== b) {
            expect(compagni.get(`${a}|${b}`)).toBe(1);
            expect(avversari.get(`${a}|${b}`)).toBe(2);
          }
    }
    const turni = [...perPartita.values()].map((g) => g[0].turno).sort();
    expect(turni).toEqual([1, 1, 2, 2, 3, 3]);
  });

  it.each(["bozza", "iscrizioni_aperte", "in_corso", "conclusa"])(
    "rifiuta la generazione con la tappa «%s»",
    async (stato) => {
      const tappa = await createStage(stato);
      const e = await errore(genera(tappa));
      expect(e).toMatchObject({ code: "23514", hint: "iscrizioni_non_chiuse" });
    },
  );

  it("un giocatore non può generare i gironi", async () => {
    const tappa = await createStage();
    const giocatore = await createAuthUser(db, { email: "g@example.it" });
    expect(await errore(genera(tappa, giocatore))).toMatchObject({
      code: "42501",
    });
  });

  it("una tappa che non esiste dà P0002", async () => {
    expect(await errore(genera(crypto.randomUUID()))).toMatchObject({
      code: "P0002",
    });
  });

  it("meno di 4 iscritti: nessun girone, tutti segnalati", async () => {
    const tappa = await createStage();
    for (let i = 0; i < 3; i++) await register(tappa, "F");
    const { rows } = await genera(tappa);
    expect(rows[1]).toMatchObject({ categoria: "F", gironi: 0, partite: 0 });
    expect(rows[1].esclusi).toHaveLength(3);
    expect(rows[0]).toMatchObject({ categoria: "M", gironi: 0, esclusi: [] });
  });

  it("rigenera finché nessuna partita è iniziata", async () => {
    const tappa = await createStage();
    for (let i = 0; i < 8; i++) await register(tappa, "M");
    await genera(tappa);
    const prima = new Set((await partite(tappa)).map((r) => r.girone));
    await genera(tappa);
    const dopo = await partite(tappa);
    expect(dopo).toHaveLength(24);
    for (const r of dopo) expect(prima.has(r.girone)).toBe(false);

    await db.query("update partite set stato = 'in_corso' where id = $1", [
      dopo[0].partita,
    ]);
    expect(await errore(genera(tappa))).toMatchObject({
      hint: "partite_iniziate",
    });
  });

  it("un set già inserito impedisce la rigenerazione", async () => {
    const tappa = await createStage();
    for (let i = 0; i < 4; i++) await register(tappa, "F");
    await genera(tappa);
    const [riga] = await partite(tappa);
    await db.query(
      `update punteggi set sets = '[{"a":21,"b":18}]', versione = versione + 1
       where partita_id = $1`,
      [riga.partita],
    );
    expect(await errore(genera(tappa))).toMatchObject({
      hint: "partite_iniziate",
    });
  });

  it("la tappa resta a iscrizioni chiuse", async () => {
    const tappa = await createStage();
    for (let i = 0; i < 4; i++) await register(tappa, "M");
    await genera(tappa);
    const { rows } = await db.query<{ stato: string }>(
      "select stato from tappe where id = $1",
      [tappa],
    );
    expect(rows[0].stato).toBe("iscrizioni_chiuse");
  });
});
