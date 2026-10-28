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

function asAdmin<T>(fn: () => Promise<T>) {
  return asRole(db, "authenticated", admin, fn);
}

type Tabellone = { id: string; partite: string[]; finali: string[] };

/** A board in «finali»: a gold and a silver final of 4, matches to play. */
async function tabelloneInFinale(
  tappa: string,
  categoria: "M" | "F",
): Promise<Tabellone> {
  const { rows: tb } = await db.query<{ id: string }>(
    "select id from tabelloni where tappa_id = $1 and categoria = $2",
    [tappa, categoria],
  );
  const tabellone = tb[0].id;
  const finali: string[] = [];
  for (const [g, fase] of (
    ["finale_gold", "finale_silver"] as const
  ).entries()) {
    const { rows: gr } = await db.query<{ id: string }>(
      `insert into gironi (tabellone_id, nome, posizione, fase)
       values ($1, $2, $3, $4) returning id`,
      [
        tabellone,
        fase === "finale_gold" ? "Finale gold" : "Finale silver",
        g + 1,
        fase,
      ],
    );
    finali.push(gr[0].id);
    for (let k = 0; k < 4; k++) {
      const utente = await createAuthUser(db, {
        email: `${categoria}${g}${k}-${crypto.randomUUID()}@example.it`,
        categoria,
      });
      const { rows: i } = await db.query<{ id: string }>(
        `insert into iscrizioni (tappa_id, tabellone_id, utente_id, stato)
         values ($1, $2, $3, 'confermata') returning id`,
        [tappa, tabellone, utente],
      );
      await db.query(
        "insert into girone_iscrizioni (girone_id, iscrizione_id) values ($1, $2)",
        [gr[0].id, i[0].id],
      );
    }
    await db.query("select * from crea_partite_girone($1, $2, 'finale')", [
      tabellone,
      gr[0].id,
    ]);
  }
  await db.query("update tabelloni set fase_gioco = 'finali' where id = $1", [
    tabellone,
  ]);
  const { rows: p } = await db.query<{ id: string }>(
    "select id from partite where tabellone_id = $1 order by girone_id, turno",
    [tabellone],
  );
  return { id: tabellone, partite: p.map((r) => r.id), finali };
}

async function tappaInFinale() {
  const { rows } = await db.query<{ id: string }>(
    `insert into tappe (nome, luogo, data_inizio, data_fine, stato)
     values ('Tappa chiusura', 'Spiaggia', '2099-07-01', '2099-07-02', 'iscrizioni_chiuse')
     returning id`,
  );
  const tappa = rows[0].id;
  const m = await tabelloneInFinale(tappa, "M");
  const f = await tabelloneInFinale(tappa, "F");
  await db.query("update tappe set stato = 'in_corso' where id = $1", [tappa]);
  return { tappa, m, f };
}

/** Concludes the matches with a winner (one set 21-15). */
async function concludi(partite: string[]) {
  await db.query(
    `update punteggi set sets = '[{"a":21,"b":15}]', versione = versione + 1
     where partita_id = any($1)`,
    [partite],
  );
  await db.query("update partite set stato = 'conclusa' where id = any($1)", [
    partite,
  ]);
}

const chiudi = (tabellone: string, punti: unknown = []) =>
  asAdmin(() =>
    db.query<{ concluso_il: Date; tappa_conclusa: boolean }>(
      "select * from concludi_tabellone($1, $2::jsonb)",
      [tabellone, JSON.stringify(punti)],
    ),
  );

async function statoTappa(tappa: string) {
  const { rows } = await db.query<{ stato: string }>(
    "select stato from tappe where id = $1",
    [tappa],
  );
  return rows[0].stato;
}

async function punteggio(partita: string) {
  const { rows } = await db.query<{ sets: unknown; versione: number }>(
    "select sets, versione from punteggi where partita_id = $1",
    [partita],
  );
  return rows[0];
}

beforeEach(async () => {
  db = await createTestDatabase();
  admin = await createAuthUser(db, { email: "admin@example.it" });
  await db.query("update utenti set ruolo = 'admin' where id = $1", [admin]);
});

describe("vincitore_sets", () => {
  it.each([
    ['[{"a":21,"b":15}]', "A"],
    ['[{"a":18,"b":21},{"a":21,"b":17},{"a":12,"b":15}]', "B"],
    ['[{"a":21,"b":15},{"a":15,"b":21}]', null],
    ["[]", null],
  ])("%s → %s", async (sets, atteso) => {
    const { rows } = await db.query<{ v: string | null }>(
      "select vincitore_sets($1::jsonb) as v",
      [sets],
    );
    expect(rows[0].v).toBe(atteso);
  });
});

describe("concludi_tabellone", () => {
  it("solo l'amministrazione chiude un tabellone", async () => {
    const { m } = await tappaInFinale();
    const giocatore = await createAuthUser(db, { email: "g@example.it" });
    const e = await errore(
      asRole(db, "authenticated", giocatore, () =>
        db.query("select * from concludi_tabellone($1)", [m.id]),
      ),
    );
    expect(e.code).toBe("42501");
  });

  it("rifiuta la chiusura con una partita non conclusa, e dice quante", async () => {
    const { m } = await tappaInFinale();
    await concludi(m.partite.slice(0, 4));
    const e = await errore(chiudi(m.id));
    expect(e.hint).toBe("partite_non_concluse");
    expect(e.detail).toBe("2");
  });

  it("rifiuta una partita conclusa senza vincitore", async () => {
    const { m } = await tappaInFinale();
    await concludi(m.partite);
    await db.query(
      `update punteggi set sets = '[{"a":21,"b":15},{"a":15,"b":21}]', versione = versione + 1
       where partita_id = $1`,
      [m.partite[0]],
    );
    expect((await errore(chiudi(m.id))).hint).toBe("partite_non_concluse");
  });

  it("rifiuta un tabellone che non è nelle finali", async () => {
    const { m } = await tappaInFinale();
    await concludi(m.partite);
    await db.query(
      "update tabelloni set fase_gioco = 'gironi_gold_silver' where id = $1",
      [m.id],
    );
    expect((await errore(chiudi(m.id))).hint).toBe("fase_non_finali");
  });

  it("chiude il tabellone, scrive il registro e conclude la tappa con il secondo", async () => {
    const { tappa, m, f } = await tappaInFinale();
    await concludi([...m.partite, ...f.partite]);

    const punti = [{ iscrizioneId: "x", punti: 12 }];
    const { rows } = await chiudi(m.id, punti);
    expect(rows[0].tappa_conclusa).toBe(false);
    expect(rows[0].concluso_il).not.toBeNull();
    expect(await statoTappa(tappa)).toBe("in_corso");
    const { rows: conclusi } = await db.query<{ c: boolean }>(
      "select tabelloni_conclusi($1) as c",
      [tappa],
    );
    expect(conclusi[0].c).toBe(false);

    const { rows: voci } = await db.query<{
      tipo: string;
      entita: string;
      valore_dopo: { tappa_id: string; categoria: string; punti: unknown };
    }>(
      "select tipo, entita, valore_dopo from registro where tipo = 'chiusura_tabellone'",
    );
    expect(voci).toHaveLength(1);
    expect(voci[0].entita).toBe("tabelloni");
    expect(voci[0].valore_dopo.tappa_id).toBe(tappa);
    expect(voci[0].valore_dopo.categoria).toBe("M");
    expect(voci[0].valore_dopo.punti).toEqual(punti);

    expect((await errore(chiudi(m.id))).hint).toBe("tabellone_concluso");

    const secondo = await chiudi(f.id);
    expect(secondo.rows[0].tappa_conclusa).toBe(true);
    expect(await statoTappa(tappa)).toBe("conclusa");

    // BLVS-22: with both boards closed the stage can be archived.
    await asAdmin(() =>
      db.query("update tappe set stato = 'archiviata' where id = $1", [tappa]),
    );
    expect(await statoTappa(tappa)).toBe("archiviata");
  });

  it("rifiuta una tappa che non è in corso", async () => {
    const { tappa, m } = await tappaInFinale();
    await concludi(m.partite);
    await db.query(
      "update tappe set stato = 'annullata', motivo_annullamento = 'Meteo' where id = $1",
      [tappa],
    );
    expect((await errore(chiudi(m.id))).hint).toBe("tappa_non_in_corso");
  });
});

describe("correzione su tabellone concluso", () => {
  async function chiuso() {
    const dati = await tappaInFinale();
    await concludi([...dati.m.partite, ...dati.f.partite]);
    await chiudi(dati.m.id);
    return dati;
  }

  it("una scrittura dei set senza conferma è rifiutata, anche dal backend", async () => {
    const { m } = await chiuso();
    const e = await errore(
      db.query(
        `update punteggi set sets = '[{"a":21,"b":19}]', versione = versione + 1
         where partita_id = $1`,
        [m.partite[0]],
      ),
    );
    expect(e.hint).toBe("conferma_tabellone_concluso");
  });

  it("la correzione confermata di una finale salva, versiona e va nel registro", async () => {
    const { tappa, m } = await chiuso();
    const prima = await punteggio(m.partite[0]);
    const { rows } = await asAdmin(() =>
      db.query<{ correggi_tabellone_concluso: number }>(
        "select correggi_tabellone_concluso($1, $2, $3::jsonb)",
        [m.partite[0], prima.versione, '[{"a":15,"b":21}]'],
      ),
    );
    expect(rows[0].correggi_tabellone_concluso).toBe(prima.versione + 1);
    expect((await punteggio(m.partite[0])).sets).toEqual([{ a: 15, b: 21 }]);

    const { rows: voci } = await db.query<{
      nota: string;
      valore_dopo: { tappa_id: string };
    }>(
      "select nota, valore_dopo from registro where tipo = 'correzione_punteggio'",
    );
    expect(voci).toHaveLength(1);
    expect(voci[0].nota).toBe("Correzione su tabellone concluso");
    expect(voci[0].valore_dopo.tappa_id).toBe(tappa);

    // The board stays closed.
    const { rows: tb } = await db.query<{ concluso_il: Date | null }>(
      "select concluso_il from tabelloni where id = $1",
      [m.id],
    );
    expect(tb[0].concluso_il).not.toBeNull();
  });

  it("rifiuta una versione superata e un punteggio senza vincitore", async () => {
    const { m } = await chiuso();
    const { versione } = await punteggio(m.partite[0]);
    const vecchia = await errore(
      asAdmin(() =>
        db.query("select correggi_tabellone_concluso($1, $2, $3::jsonb)", [
          m.partite[0],
          versione - 1,
          '[{"a":15,"b":21}]',
        ]),
      ),
    );
    expect(vecchia.code).toBe("40001");
    expect(vecchia.hint).toBe("versione_superata");
    const pari = await errore(
      asAdmin(() =>
        db.query("select correggi_tabellone_concluso($1, $2, $3::jsonb)", [
          m.partite[0],
          versione,
          "[]",
        ]),
      ),
    );
    expect(pari.hint).toBe("senza_vincitore");
  });

  it("rifiuta la correzione su un tabellone aperto", async () => {
    const { f } = await chiuso();
    const { versione } = await punteggio(f.partite[0]);
    const e = await errore(
      asAdmin(() =>
        db.query("select correggi_tabellone_concluso($1, $2, $3::jsonb)", [
          f.partite[0],
          versione,
          '[{"a":15,"b":21}]',
        ]),
      ),
    );
    expect(e.hint).toBe("tabellone_non_concluso");
  });
});

describe("correggi_punteggio su tabellone concluso (gironi)", () => {
  /** A concluded initial group whose board then reached the closed finals. */
  async function gironeChiuso() {
    const dati = await tappaInFinale();
    const { rows: g } = await db.query<{ id: string }>(
      `insert into gironi (tabellone_id, nome, posizione, fase)
       values ($1, 'Girone A', 10, 'iniziale') returning id`,
      [dati.m.id],
    );
    const { rows: membri } = await db.query<{ iscrizione_id: string }>(
      "select iscrizione_id from girone_iscrizioni where girone_id = $1",
      [dati.m.finali[0]],
    );
    for (const { iscrizione_id } of membri) {
      await db.query(
        "insert into girone_iscrizioni (girone_id, iscrizione_id) values ($1, $2)",
        [g[0].id, iscrizione_id],
      );
    }
    const { rows: p } = await db.query<{ partita_id: string }>(
      "select partita_id from crea_partite_girone($1, $2, 'gironi')",
      [dati.m.id, g[0].id],
    );
    const gironi = p.map((r) => r.partita_id);
    await concludi([...gironi, ...dati.m.partite, ...dati.f.partite]);
    await chiudi(dati.m.id);
    await chiudi(dati.f.id);
    return { ...dati, partita: gironi[0] };
  }

  const correggi = (
    partita: string,
    versione: number,
    scelta: string | null,
    conferma: boolean,
    attesi: number | null = null,
  ) =>
    asAdmin(() =>
      db.query("select * from correggi_punteggio($1, $2, 21, 19, $3, $4, $5)", [
        partita,
        versione,
        scelta,
        conferma,
        attesi,
      ]),
    );

  it("chiede l'impatto, rifiuta «Rigenera» e vuole la conferma esplicita", async () => {
    const { tappa, partita } = await gironeChiuso();
    expect(await statoTappa(tappa)).toBe("conclusa");
    const { versione } = await punteggio(partita);
    const impatto = await errore(correggi(partita, versione, null, false));
    expect(impatto.hint).toBe("impatto_richiesto");
    // The 6 scored finals of the board.
    const attesi = Number(impatto.detail);
    expect(attesi).toBe(6);
    expect(
      (await errore(correggi(partita, versione, "rigenera", true, attesi)))
        .hint,
    ).toBe("tabellone_concluso");
    expect(
      (await errore(correggi(partita, versione, "mantieni", false, attesi)))
        .hint,
    ).toBe("conferma_tabellone_concluso");

    await correggi(partita, versione, "mantieni", true, attesi);
    expect((await punteggio(partita)).sets).toEqual([{ a: 21, b: 19 }]);
    const { rows } = await db.query<{ nota: string }>(
      "select nota from registro where tipo = 'correzione_punteggio'",
    );
    expect(rows[0].nota).toBe(
      "Correzione su tabellone concluso · Fase successiva mantenuta",
    );
  });
});
