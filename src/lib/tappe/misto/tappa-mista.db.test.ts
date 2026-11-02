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

type DbError = { code?: string; hint?: string; message: string };

async function errore(promise: Promise<unknown>): Promise<DbError> {
  try {
    await promise;
  } catch (error) {
    return error as DbError;
  }
  throw new Error("La chiamata doveva fallire");
}

function comeAdmin<T>(fn: () => Promise<T>) {
  return asRole(db, "authenticated", admin, fn);
}

async function createPlayer(categoria: "M" | "F") {
  const id = await createAuthUser(db, {
    email: `${crypto.randomUUID()}@example.it`,
    categoria,
  });
  await db.query(
    "update auth.users set email_confirmed_at = now() where id = $1",
    [id],
  );
  return id;
}

/** A mixed stage with `posti` seats, open for registration. */
async function createMixedStage(posti = 8, stato = "iscrizioni_aperte") {
  const { rows } = await db.query<{ id: string }>(
    `insert into tappe (nome, luogo, data_inizio, data_fine, stato,
       iscrizioni_chiudono_il, formato)
     values ('Misto test', 'Spiaggia', '2099-06-10', '2099-06-10',
       $1::stato_tappa, '2099-06-01 23:59+02', 'misto')
     returning id`,
    [stato],
  );
  const id = rows[0].id;
  await db.query("update tabelloni set posti = $2 where tappa_id = $1", [
    id,
    posti,
  ]);
  return id;
}

/** A confirmed registration in the mixed board (backend, no checks). */
async function registerConfirmed(tappa: string, categoria: "M" | "F") {
  const utente = await createPlayer(categoria);
  const { rows } = await db.query<{ id: string }>(
    `insert into iscrizioni (tappa_id, tabellone_id, utente_id, stato)
     select $1, id, $2, 'confermata' from tabelloni where tappa_id = $1
     returning id`,
    [tappa, utente],
  );
  return { utente, iscrizione: rows[0].id, categoria };
}

function iscriviti(utente: string, tappa: string) {
  return asRole(db, "authenticated", utente, async () => {
    try {
      const { rows } = await db.query<{ posto: number; tabellone_id: string }>(
        "select * from public.iscriviti_tappa($1)",
        [tappa],
      );
      return { ok: true as const, row: rows[0] };
    } catch (error) {
      return { ok: false as const, error: error as DbError };
    }
  });
}

async function tabelloneDi(tappa: string) {
  const { rows } = await db.query<{ id: string; categoria: string }>(
    "select id, categoria from tabelloni where tappa_id = $1",
    [tappa],
  );
  return rows;
}

beforeEach(async () => {
  db = await createTestDatabase();
  admin = await createPlayer("M");
  await db.query("update utenti set ruolo = 'admin' where id = $1", [admin]);
});

describe("tappa mista: creazione e formato", () => {
  it("crea_tappa_mista crea un solo tabellone X con il massimo dato", async () => {
    const { rows } = await comeAdmin(() =>
      db.query<{ id: string }>(
        "select crea_tappa_mista('K&Q misto', 'Jesolo', '2099-07-01', '2099-06-30 20:00+02', 32) as id",
      ),
    );
    const id = rows[0].id;
    const tappa = await db.query<{ formato: string; stato: string }>(
      "select formato, stato from tappe where id = $1",
      [id],
    );
    expect(tappa.rows[0]).toEqual({ formato: "misto", stato: "bozza" });
    const tabelloni = await db.query<{ categoria: string; posti: number }>(
      "select categoria, posti from tabelloni where tappa_id = $1",
      [id],
    );
    expect(tabelloni.rows).toEqual([{ categoria: "X", posti: 32 }]);
  });

  it("rifiuta un massimo dispari o fuori intervallo", async () => {
    const chiama = (posti: number) =>
      comeAdmin(() =>
        db.query(
          "select crea_tappa_mista('K&Q', 'Jesolo', '2099-07-01', '2099-06-30 20:00+02', $1)",
          [posti],
        ),
      );
    expect((await errore(chiama(15))).hint).toBe("posti_dispari");
    expect((await errore(chiama(2))).hint).toBe("posti");
    expect((await errore(chiama(258))).hint).toBe("posti");
  });

  it("solo un admin crea una tappa mista", async () => {
    const giocatore = await createPlayer("F");
    const e = await errore(
      asRole(db, "authenticated", giocatore, () =>
        db.query(
          "select crea_tappa_mista('K&Q', 'Jesolo', '2099-07-01', '2099-06-30 20:00+02', 16)",
        ),
      ),
    );
    expect(e.code).toBe("42501");
  });

  it("la tappa classica tiene i tabelloni M e F", async () => {
    const { rows } = await db.query<{ id: string }>(
      `insert into tappe (nome, luogo, data_inizio, data_fine)
       values ('Classica', 'Spiaggia', '2099-06-10', '2099-06-10') returning id`,
    );
    const tabelloni = await tabelloneDi(rows[0].id);
    expect(tabelloni.map((t) => t.categoria).sort()).toEqual(["F", "M"]);
  });

  it("il formato non cambia dopo la creazione", async () => {
    const tappa = await createMixedStage();
    const e = await errore(
      db.query("update tappe set formato = 'classico' where id = $1", [tappa]),
    );
    expect(e.hint).toBe("formato_fisso");
  });

  it("X non è mai la categoria di un giocatore", async () => {
    const e = await errore(
      db.query("update utenti set categoria = 'X' where id = $1", [admin]),
    );
    expect(e.code).toBe("23514");
  });

  it("una tappa mista non accetta tabelloni M o F", async () => {
    const tappa = await createMixedStage();
    const e = await errore(
      db.query("update tabelloni set categoria = 'M' where tappa_id = $1", [
        tappa,
      ]),
    );
    expect(e.hint).toBe("categoria_tabellone");
  });
});

describe("tappa mista: iscrizioni con metà posti per categoria", () => {
  it("uomini e donne entrano nello stesso tabellone, ognuno nella sua metà", async () => {
    const tappa = await createMixedStage(4);
    const [tabellone] = await tabelloneDi(tappa);

    const m1 = await iscriviti(await createPlayer("M"), tappa);
    const m2 = await iscriviti(await createPlayer("M"), tappa);
    const m3 = await iscriviti(await createPlayer("M"), tappa);
    const f1 = await iscriviti(await createPlayer("F"), tappa);

    expect(m1).toMatchObject({ ok: true, row: { posto: 1 } });
    expect(m2).toMatchObject({ ok: true, row: { posto: 2 } });
    expect(m3).toMatchObject({ ok: false, error: { hint: "posti_esauriti" } });
    expect(f1).toMatchObject({
      ok: true,
      row: { posto: 3, tabellone_id: tabellone.id },
    });
  });

  it("posti_tappe e tabelloni_tappa mostrano le due metà", async () => {
    const tappa = await createMixedStage(8);
    await iscriviti(await createPlayer("M"), tappa);
    await iscriviti(await createPlayer("M"), tappa);
    await iscriviti(await createPlayer("F"), tappa);

    const posti = await asRole(db, "anon", null, () =>
      db.query<{ categoria: string; posti: number; occupati: number }>(
        "select categoria, posti, occupati from posti_tappe() where tappa_id = $1 order by categoria",
        [tappa],
      ),
    );
    expect(posti.rows).toEqual([
      { categoria: "M", posti: 4, occupati: 2 },
      { categoria: "F", posti: 4, occupati: 1 },
    ]);

    const tabelloni = await asRole(db, "anon", null, () =>
      db.query<{ categoria: string; posti: number; prossimo_posto: number }>(
        "select categoria, posti, prossimo_posto from tabelloni_tappa($1)",
        [tappa],
      ),
    );
    expect(tabelloni.rows).toEqual([
      { categoria: "M", posti: 4, prossimo_posto: 4 },
      { categoria: "F", posti: 4, prossimo_posto: 4 },
    ]);
  });

  it("una metà piena non ha più un prossimo posto", async () => {
    const tappa = await createMixedStage(4);
    await iscriviti(await createPlayer("F"), tappa);
    await iscriviti(await createPlayer("F"), tappa);
    const { rows } = await db.query<{
      categoria: string;
      prossimo_posto: number | null;
    }>("select categoria, prossimo_posto from tabelloni_tappa($1)", [tappa]);
    expect(rows).toEqual([
      { categoria: "M", prossimo_posto: 3 },
      { categoria: "F", prossimo_posto: null },
    ]);
  });

  it("l'admin iscrive nel misto rispettando la metà della categoria", async () => {
    const tappa = await createMixedStage(4);
    const f1 = await createPlayer("F");
    const f2 = await createPlayer("F");
    const f3 = await createPlayer("F");
    const iscrivi = (utente: string) =>
      comeAdmin(() =>
        db.query("select * from admin_iscrivi_giocatore($1, $2)", [
          tappa,
          utente,
        ]),
      );
    await iscrivi(f1);
    await iscrivi(f2);
    expect((await errore(iscrivi(f3))).hint).toBe("posti_esauriti");
    await iscrivi(await createPlayer("M"));
  });

  it("il massimo resta pari e non scende sotto la metà più piena", async () => {
    const tappa = await createMixedStage(8);
    for (let i = 0; i < 3; i++) await registerConfirmed(tappa, "M");
    await registerConfirmed(tappa, "F");
    const cambia = (posti: number) =>
      db.query("update tabelloni set posti = $2 where tappa_id = $1", [
        tappa,
        posti,
      ]);
    expect((await errore(cambia(7))).hint).toBe("posti_dispari");
    const sotto = await errore(cambia(4));
    expect(sotto.hint).toBe("posti_sotto_iscritti");
    await cambia(6);
  });
});

describe("tappa mista: gironi 2 uomini + 2 donne", () => {
  type Riga = {
    girone: string;
    turno: number;
    squadra: "A" | "B";
    categoria: "M" | "F";
    iscrizione: string;
  };

  async function partite(tappa: string) {
    const { rows } = await db.query<Riga>(
      `select g.id as girone, p.turno, pg.squadra, u.categoria,
              pg.iscrizione_id as iscrizione
       from gironi g
       join tabelloni tb on tb.id = g.tabellone_id
       join partite p on p.girone_id = g.id
       join partita_giocatori pg on pg.partita_id = p.id
       join iscrizioni i on i.id = pg.iscrizione_id
       join utenti u on u.id = i.utente_id
       where tb.tappa_id = $1
       order by g.posizione, p.turno, pg.squadra`,
      [tappa],
    );
    return rows;
  }

  function verificaMiste(righe: Riga[]) {
    const squadre = new Map<string, string[]>();
    for (const r of righe) {
      const chiave = `${r.girone}:${r.turno}:${r.squadra}`;
      squadre.set(chiave, [...(squadre.get(chiave) ?? []), r.categoria]);
    }
    for (const categorie of squadre.values()) {
      expect(categorie.sort()).toEqual(["F", "M"]);
    }
    // Ognuno fa coppia con ciascuno dell'altra categoria del girone.
    const compagni = new Map<string, Set<string>>();
    const perSquadra = new Map<string, Riga[]>();
    for (const r of righe) {
      const chiave = `${r.girone}:${r.turno}:${r.squadra}`;
      perSquadra.set(chiave, [...(perSquadra.get(chiave) ?? []), r]);
    }
    for (const [a, b] of perSquadra.values()) {
      compagni.set(
        a.iscrizione,
        (compagni.get(a.iscrizione) ?? new Set()).add(b.iscrizione),
      );
      compagni.set(
        b.iscrizione,
        (compagni.get(b.iscrizione) ?? new Set()).add(a.iscrizione),
      );
    }
    for (const set of compagni.values()) expect(set.size).toBe(2);
  }

  it("genera_gironi: gironi 2+2, due partite con coppie miste, esclusi segnalati", async () => {
    const tappa = await createMixedStage(16, "iscrizioni_chiuse");
    for (let i = 0; i < 5; i++) await registerConfirmed(tappa, "M");
    for (let i = 0; i < 4; i++) await registerConfirmed(tappa, "F");

    const { rows } = await comeAdmin(() =>
      db.query<{
        categoria: string;
        gironi: number;
        partite: number;
        esclusi: unknown[];
      }>("select * from genera_gironi($1)", [tappa]),
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ categoria: "X", gironi: 2, partite: 4 });
    expect(rows[0].esclusi).toHaveLength(1);

    const composizione = await db.query<{ m: number; f: number }>(
      `select count(*) filter (where u.categoria = 'M')::int as m,
              count(*) filter (where u.categoria = 'F')::int as f
       from gironi g
       join tabelloni tb on tb.id = g.tabellone_id
       join girone_iscrizioni gi on gi.girone_id = g.id
       join iscrizioni i on i.id = gi.iscrizione_id
       join utenti u on u.id = i.utente_id
       where tb.tappa_id = $1
       group by g.id`,
      [tappa],
    );
    expect(composizione.rows).toEqual([
      { m: 2, f: 2 },
      { m: 2, f: 2 },
    ]);
    const righe = await partite(tappa);
    expect(righe).toHaveLength(2 * 2 * 4);
    verificaMiste(righe);
  });

  it("giocatori_girone mette prima gli uomini", async () => {
    const tappa = await createMixedStage(8, "iscrizioni_chiuse");
    // Le donne prendono i posti più bassi: l'ordine resta comunque M, M, F, F.
    await registerConfirmed(tappa, "F");
    await registerConfirmed(tappa, "F");
    await registerConfirmed(tappa, "M");
    await registerConfirmed(tappa, "M");
    await comeAdmin(() => db.query("select * from genera_gironi($1)", [tappa]));
    const { rows } = await comeAdmin(() =>
      db.query<{ lettera: string; categoria: string }>(
        `select gg.lettera, gg.categoria
         from gironi g
         join tabelloni tb on tb.id = g.tabellone_id,
         lateral giocatori_girone(g.id) gg
         where tb.tappa_id = $1`,
        [tappa],
      ),
    );
    expect(rows).toEqual([
      { lettera: "A", categoria: "M" },
      { lettera: "B", categoria: "M" },
      { lettera: "C", categoria: "F" },
      { lettera: "D", categoria: "F" },
    ]);
  });

  it("avvia_fase crea 2 partite per girone e blocca un girone non 2+2", async () => {
    const tappa = await createMixedStage(8, "iscrizioni_chiuse");
    const m = [
      await registerConfirmed(tappa, "M"),
      await registerConfirmed(tappa, "M"),
      await registerConfirmed(tappa, "M"),
      await registerConfirmed(tappa, "M"),
    ];
    const f = [
      await registerConfirmed(tappa, "F"),
      await registerConfirmed(tappa, "F"),
      await registerConfirmed(tappa, "F"),
      await registerConfirmed(tappa, "F"),
    ];
    const [tabellone] = await tabelloneDi(tappa);
    await comeAdmin(() => db.query("select * from genera_gironi($1)", [tappa]));

    // Scambio a mano: un girone con 3 uomini e 1 donna.
    const gironi = await db.query<{ id: string }>(
      "select id from gironi where tabellone_id = $1 order by posizione",
      [tabellone.id],
    );
    const [g1, g2] = gironi.rows.map((r) => r.id);
    const membri = async (girone: string) =>
      (
        await db.query<{ iscrizione_id: string; categoria: string }>(
          `select gi.iscrizione_id, u.categoria from girone_iscrizioni gi
           join iscrizioni i on i.id = gi.iscrizione_id
           join utenti u on u.id = i.utente_id
           where gi.girone_id = $1`,
          [girone],
        )
      ).rows;
    const uomo2 = (await membri(g2)).find((r) => r.categoria === "M")!;
    const donna1 = (await membri(g1)).find((r) => r.categoria === "F")!;
    await db.query(
      "update girone_iscrizioni set girone_id = $1 where iscrizione_id = $2",
      [g1, uomo2.iscrizione_id],
    );
    await db.query(
      "update girone_iscrizioni set girone_id = $1 where iscrizione_id = $2",
      [g2, donna1.iscrizione_id],
    );

    const controlli = await comeAdmin(() =>
      db.query<{ regola: string; dettaglio: string }>(
        "select regola, dettaglio from controlli_avvio_fase($1)",
        [tabellone.id],
      ),
    );
    expect(controlli.rows).toEqual([
      { regola: "girone_non_misto", dettaglio: "3:1" },
      { regola: "girone_non_misto", dettaglio: "1:3" },
    ]);
    const bloccato = await errore(
      comeAdmin(() => db.query("select * from avvia_fase($1)", [tabellone.id])),
    );
    expect(bloccato.hint).toBe("avvio_bloccato");

    // Rimesso a posto, la fase parte con 2 partite per girone.
    await db.query(
      "update girone_iscrizioni set girone_id = $1 where iscrizione_id = $2",
      [g2, uomo2.iscrizione_id],
    );
    await db.query(
      "update girone_iscrizioni set girone_id = $1 where iscrizione_id = $2",
      [g1, donna1.iscrizione_id],
    );
    const avviate = await comeAdmin(() =>
      db.query<{ turno: number }>("select * from avvia_fase($1)", [
        tabellone.id,
      ]),
    );
    expect(avviate.rows.map((r) => r.turno)).toEqual([1, 2, 1, 2]);
    verificaMiste(await partite(tappa));
    expect(m).toHaveLength(4);
    expect(f).toHaveLength(4);
  });
});

describe("tappa mista: fuori dalla classifica generale", () => {
  it("classifica_tabellone_dati legge solo M e F", async () => {
    const tappa = await createMixedStage(8, "in_corso");
    await registerConfirmed(tappa, "M");
    const dati = await db.query<{ m: { tappe: unknown[] } }>(
      "select classifica_tabellone_dati('M') as m",
    );
    expect(dati.rows[0].m.tappe).toEqual([]);
  });
});

describe("tappa mista: editor e finali", () => {
  it("gironi_editor dà la categoria dei giocatori solo nel misto", async () => {
    const tappa = await createMixedStage(8, "iscrizioni_chiuse");
    for (const c of ["M", "M", "F", "F"] as const) {
      await registerConfirmed(tappa, c);
    }
    const [tabellone] = await tabelloneDi(tappa);
    await comeAdmin(() => db.query("select * from genera_gironi($1)", [tappa]));
    const { rows } = await comeAdmin(() =>
      db.query<{
        e: { gironi: { giocatori: { categoria: string | null }[] }[] };
      }>("select gironi_editor($1) as e", [tabellone.id]),
    );
    expect(
      rows[0].e.gironi[0].giocatori.map((g) => g.categoria).sort(),
    ).toEqual(["F", "F", "M", "M"]);
  });

  it("genera_finali vuole finali da 2 uomini + 2 donne e crea 2 partite", async () => {
    const tappa = await createMixedStage(8, "in_corso");
    const m = [];
    const f = [];
    for (let i = 0; i < 4; i++) m.push(await registerConfirmed(tappa, "M"));
    for (let i = 0; i < 4; i++) f.push(await registerConfirmed(tappa, "F"));
    const [tabellone] = await tabelloneDi(tappa);
    const id = (p: { iscrizione: string }) => p.iscrizione;

    // Un girone gold sbilanciato (3 uomini + 1 donna) e uno silver, giocati.
    const gironi: Record<string, string> = {};
    for (const [fase, membri] of [
      ["gold", [m[0], m[1], m[2], f[0]]],
      ["silver", [m[3], f[1], f[2], f[3]]],
    ] as const) {
      const g = await db.query<{ id: string }>(
        `insert into gironi (tabellone_id, nome, posizione, fase)
         values ($1, $2, $3, $2) returning id`,
        [tabellone.id, fase, fase === "gold" ? 1 : 2],
      );
      gironi[fase] = g.rows[0].id;
      for (const p of membri) {
        await db.query(
          "insert into girone_iscrizioni (girone_id, iscrizione_id) values ($1, $2)",
          [g.rows[0].id, id(p)],
        );
      }
      await db.query(
        `insert into partite (tabellone_id, girone_id, fase, turno, stato)
         values ($1, $2, 'gironi', 1, 'conclusa')`,
        [tabellone.id, g.rows[0].id],
      );
    }
    await db.query(
      "update tabelloni set fase_gioco = 'gironi_gold_silver' where id = $1",
      [tabellone.id],
    );

    const genera = (gold: string[], silver: string[]) =>
      comeAdmin(() =>
        db.query<{ turno: number }>("select * from genera_finali($1, $2)", [
          tabellone.id,
          JSON.stringify([
            { fase: "finale_gold", iscrizioni: gold },
            { fase: "finale_silver", iscrizioni: silver },
          ]),
        ]),
      );

    // Tutti arrivano dal girone giusto, ma la finale gold è 3 + 1.
    const sbagliata = await errore(
      genera(
        [m[0], m[1], m[2], f[0]].map(id),
        [m[3], f[1], f[2], f[3]].map(id),
      ),
    );
    expect(sbagliata.hint).toBe("finale_non_valida");
    expect(sbagliata.message).toContain("metà uomini e metà donne");

    // Rimessi 2 + 2 (m2 ↔ f1), le finali nascono con 2 partite ciascuna.
    await db.query(
      "update girone_iscrizioni set girone_id = $1 where iscrizione_id = $2",
      [gironi.silver, id(m[2])],
    );
    await db.query(
      "update girone_iscrizioni set girone_id = $1 where iscrizione_id = $2",
      [gironi.gold, id(f[1])],
    );
    const finali = await genera(
      [m[0], m[1], f[0], f[1]].map(id),
      [m[2], m[3], f[2], f[3]].map(id),
    );
    expect(finali.rows.map((r) => r.turno)).toEqual([1, 2, 1, 2]);
  });
});
