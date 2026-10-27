// @vitest-environment node
import { beforeEach, describe, expect, it } from "vitest";
import {
  asRole,
  createAuthUser,
  createTestDatabase,
  type TestDatabase,
} from "@/test/pglite";
import { REGOLA_FINALI, REGOLA_QUALIFICAZIONE } from "./regole";

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

/** A stage with 16 confirmed players on M, in 4 initial groups of 4. */
async function tabelloneConGironi() {
  const { rows } = await db.query<{ id: string }>(
    `insert into tappe (nome, luogo, data_inizio, data_fine, stato)
     values ('Tappa fasi', 'Spiaggia', '2099-07-01', '2099-07-02', 'iscrizioni_chiuse')
     returning id`,
  );
  const tappa = rows[0].id;
  const { rows: tb } = await db.query<{ id: string }>(
    "select id from tabelloni where tappa_id = $1 and categoria = 'M'",
    [tappa],
  );
  const tabellone = tb[0].id;
  const iscrizioni: string[] = [];
  for (let k = 0; k < 16; k++) {
    const utente = await createAuthUser(db, {
      email: `f${k}-${crypto.randomUUID()}@example.it`,
    });
    await db.query("update utenti set cognome = $2, nome = 'N' where id = $1", [
      utente,
      `C${String(k).padStart(2, "0")}`,
    ]);
    const { rows: i } = await db.query<{ id: string }>(
      `insert into iscrizioni (tappa_id, tabellone_id, utente_id, stato)
       values ($1, $2, $3, 'confermata') returning id`,
      [tappa, tabellone, utente],
    );
    iscrizioni.push(i[0].id);
  }
  const gironi: string[] = [];
  for (let g = 0; g < 4; g++) {
    const { rows: gr } = await db.query<{ id: string }>(
      `insert into gironi (tabellone_id, nome, posizione) values ($1, $2, $3) returning id`,
      [tabellone, `Girone ${String.fromCharCode(65 + g)}`, g + 1],
    );
    gironi.push(gr[0].id);
    for (const i of iscrizioni.slice(g * 4, g * 4 + 4)) {
      await db.query(
        "insert into girone_iscrizioni (girone_id, iscrizione_id) values ($1, $2)",
        [gr[0].id, i],
      );
    }
  }
  return { tappa, tabellone, iscrizioni, gironi };
}

/** Concludes every match of the groups of `fase`. */
async function concludi(tabellone: string, fasi: string[]) {
  await db.query(
    `update punteggi set sets = '[{"a":21,"b":15}]', versione = versione + 1
     where partita_id in (
       select p.id from partite p join gironi g on g.id = p.girone_id
       where p.tabellone_id = $1 and g.fase = any($2)
     )`,
    [tabellone, fasi],
  );
  await db.query(
    `update partite p set stato = 'conclusa'
     from gironi g
     where g.id = p.girone_id and p.tabellone_id = $1 and g.fase = any($2)`,
    [tabellone, fasi],
  );
}

/** Gold = first two players of each initial group, silver = the others. */
function propostaDi(iscrizioni: string[]) {
  const gruppo = (g: number) => iscrizioni.slice(g * 4, g * 4 + 4);
  return JSON.stringify([
    {
      fase: "gold",
      iscrizioni: [...gruppo(0).slice(0, 2), ...gruppo(1).slice(0, 2)],
    },
    {
      fase: "gold",
      iscrizioni: [...gruppo(2).slice(0, 2), ...gruppo(3).slice(0, 2)],
    },
    {
      fase: "silver",
      iscrizioni: [...gruppo(0).slice(2), ...gruppo(1).slice(2)],
    },
    {
      fase: "silver",
      iscrizioni: [...gruppo(2).slice(2), ...gruppo(3).slice(2)],
    },
  ]);
}

const proponi = (tabellone: string, proposta: string) =>
  asAdmin(() =>
    db.query<{ proponi_gironi_gold_silver: number }>(
      "select proponi_gironi_gold_silver($1, $2::jsonb)",
      [tabellone, proposta],
    ),
  );

async function editor(tabellone: string) {
  const { rows } = await asAdmin(() =>
    db.query<{ gironi_editor: Record<string, unknown> }>(
      "select gironi_editor($1)",
      [tabellone],
    ),
  );
  return rows[0].gironi_editor as {
    livello: string;
    versione: number;
    bloccata: boolean;
    gironi: { id: string; nome: string; fase: string; giocatori: unknown[] }[];
    non_assegnati: unknown[];
  };
}

beforeEach(async () => {
  db = await createTestDatabase();
  admin = await createAuthUser(db, { email: "admin@example.it" });
  await db.query("update utenti set ruolo = 'admin' where id = $1", [admin]);
});

describe("regole", () => {
  it("le regole SQL sono le stesse di quelle TS (Q-01)", async () => {
    const { rows } = await db.query<{ gold: number[]; silver: number[] }>(
      "select * from regola_qualificazione()",
    );
    expect(rows[0]).toEqual({
      gold: [...REGOLA_QUALIFICAZIONE.gold],
      silver: [...REGOLA_QUALIFICAZIONE.silver],
    });
    const { rows: f } = await db.query<{ giocatori: number }>(
      "select * from regola_finali()",
    );
    expect(f[0].giocatori).toBe(REGOLA_FINALI.giocatori);
  });
});

describe("gironi gold e silver", () => {
  it("si propongono solo a gironi iniziali conclusi", async () => {
    const { tabellone, iscrizioni } = await tabelloneConGironi();
    expect(
      (await errore(proponi(tabellone, propostaDi(iscrizioni)))).hint,
    ).toBe("fase_non_proponibile");
    await asAdmin(() => db.query("select * from avvia_fase($1)", [tabellone]));
    expect(
      (await errore(proponi(tabellone, propostaDi(iscrizioni)))).hint,
    ).toBe("gironi_non_conclusi");
  });

  it("la proposta si modifica nell'editor e poi si avvia, senza toccare i gironi iniziali", async () => {
    const { tappa, tabellone, iscrizioni } = await tabelloneConGironi();
    await asAdmin(() => db.query("select * from avvia_fase($1)", [tabellone]));
    await concludi(tabellone, ["iniziale"]);

    await proponi(tabellone, propostaDi(iscrizioni));
    const proposta = await editor(tabellone);
    expect(proposta.livello).toBe("gold_silver");
    expect(proposta.bloccata).toBe(false);
    expect(proposta.gironi.map((g) => [g.nome, g.fase])).toEqual([
      ["Gold A", "gold"],
      ["Gold B", "gold"],
      ["Silver A", "silver"],
      ["Silver B", "silver"],
    ]);
    expect(proposta.non_assegnati).toEqual([]);

    // The admin swaps a gold and a silver player: only the gold/silver
    // groups change, the initial ones keep everybody.
    const versione = await asAdmin(() =>
      db.query<{ scambia_in_girone: number }>(
        "select scambia_in_girone($1, $2, $3, $4)",
        [tabellone, proposta.versione, iscrizioni[0], iscrizioni[2]],
      ),
    );
    expect(versione.rows[0].scambia_in_girone).toBe(proposta.versione + 1);
    const { rows: iniziali } = await db.query<{ n: number }>(
      `select count(*)::int as n from girone_iscrizioni gi
       join gironi g on g.id = gi.girone_id
       where g.tabellone_id = $1 and g.fase = 'iniziale'`,
      [tabellone],
    );
    expect(iniziali[0].n).toBe(16);
    const { rows: oro } = await db.query<{ fase: string }>(
      `select g.fase from girone_iscrizioni gi join gironi g on g.id = gi.girone_id
       where gi.iscrizione_id = $1 and g.fase <> 'iniziale'`,
      [iscrizioni[2]],
    );
    expect(oro).toEqual([{ fase: "gold" }]);

    const avviate = await asAdmin(() =>
      db.query("select * from avvia_fase($1)", [tabellone]),
    );
    expect(avviate.rows).toHaveLength(12);
    const { rows: stato } = await db.query<{ fase_gioco: string; n: number }>(
      `select tb.fase_gioco, (select count(*)::int from partite p where p.tabellone_id = tb.id) as n
       from tabelloni tb where tb.id = $1`,
      [tabellone],
    );
    expect(stato[0]).toEqual({ fase_gioco: "gironi_gold_silver", n: 24 });
    const { rows: t } = await db.query<{ stato: string }>(
      "select stato from tappe where id = $1",
      [tappa],
    );
    expect(t[0].stato).toBe("in_corso");

    // Started: the gold/silver groups no longer change, and the groups
    // can't be regenerated.
    const dopo = await editor(tabellone);
    expect(dopo.bloccata).toBe(true);
    expect(
      (
        await errore(
          asAdmin(() =>
            db.query("select sposta_in_girone($1, $2, $3, null)", [
              tabellone,
              dopo.versione,
              iscrizioni[0],
            ]),
          ),
        )
      ).hint,
    ).toBe("gironi_non_modificabili");
    expect(
      (
        await errore(
          asAdmin(() =>
            db.query("select * from rigenera_gironi($1, true, 0)", [tabellone]),
          ),
        )
      ).hint,
    ).toBe("fase_successiva");
  });

  it("rifiuta un giocatore che non arriva dai gironi iniziali", async () => {
    const { tabellone, iscrizioni } = await tabelloneConGironi();
    await asAdmin(() => db.query("select * from avvia_fase($1)", [tabellone]));
    await concludi(tabellone, ["iniziale"]);
    const proposta = JSON.stringify([
      { fase: "gold", iscrizioni: [crypto.randomUUID()] },
    ]);
    expect((await errore(proponi(tabellone, proposta))).hint).toBe(
      "proposta_non_valida",
    );
    const doppia = JSON.stringify([
      { fase: "gold", iscrizioni: [iscrizioni[0]] },
      { fase: "silver", iscrizioni: [iscrizioni[0]] },
    ]);
    expect((await errore(proponi(tabellone, doppia))).hint).toBe(
      "proposta_non_valida",
    );
  });

  it("aggiunge un girone silver con il suo nome", async () => {
    const { tabellone, iscrizioni } = await tabelloneConGironi();
    await asAdmin(() => db.query("select * from avvia_fase($1)", [tabellone]));
    await concludi(tabellone, ["iniziale"]);
    await proponi(tabellone, propostaDi(iscrizioni));
    const { versione } = await editor(tabellone);
    await asAdmin(() =>
      db.query("select aggiungi_girone($1, $2, 'silver')", [
        tabellone,
        versione,
      ]),
    );
    expect((await editor(tabellone)).gironi.at(-1)).toMatchObject({
      nome: "Silver C",
      fase: "silver",
    });
    expect(
      (
        await errore(
          asAdmin(() =>
            db.query("select aggiungi_girone($1, $2, 'iniziale')", [
              tabellone,
              versione + 1,
            ]),
          ),
        )
      ).hint,
    ).toBe("fase_non_valida");
  });
});

describe("finali", () => {
  async function goldSilverAvviati() {
    const dati = await tabelloneConGironi();
    await asAdmin(() =>
      db.query("select * from avvia_fase($1)", [dati.tabellone]),
    );
    await concludi(dati.tabellone, ["iniziale"]);
    await proponi(dati.tabellone, propostaDi(dati.iscrizioni));
    await asAdmin(() =>
      db.query("select * from avvia_fase($1)", [dati.tabellone]),
    );
    return dati;
  }

  const genera = (tabellone: string, finali: unknown) =>
    asAdmin(() =>
      db.query("select * from genera_finali($1, $2::jsonb)", [
        tabellone,
        JSON.stringify(finali),
      ]),
    );

  it("genera la finale gold e la finale silver e passa il tabellone a «finali»", async () => {
    const { tabellone, iscrizioni } = await goldSilverAvviati();
    const finali = [
      {
        fase: "finale_gold",
        iscrizioni: [
          iscrizioni[0],
          iscrizioni[1],
          iscrizioni[8],
          iscrizioni[9],
        ],
      },
      {
        fase: "finale_silver",
        iscrizioni: [
          iscrizioni[2],
          iscrizioni[3],
          iscrizioni[10],
          iscrizioni[11],
        ],
      },
    ];
    expect((await errore(genera(tabellone, finali))).hint).toBe(
      "gironi_non_conclusi",
    );
    await concludi(tabellone, ["gold", "silver"]);

    expect(
      (
        await errore(
          genera(tabellone, [
            { fase: "finale_gold", iscrizioni: [iscrizioni[0]] },
          ]),
        )
      ).hint,
    ).toBe("finale_non_valida");
    expect(
      (
        await errore(
          genera(tabellone, [
            {
              fase: "finale_gold",
              iscrizioni: [
                iscrizioni[2],
                iscrizioni[1],
                iscrizioni[8],
                iscrizioni[9],
              ],
            },
          ]),
        )
      ).hint,
    ).toBe("finale_non_valida");

    const create = await genera(tabellone, finali);
    expect(create.rows).toHaveLength(6);
    const { rows } = await db.query<{ fase_gioco: string; finali: number }>(
      `select tb.fase_gioco,
         (select count(*)::int from partite p where p.tabellone_id = tb.id and p.fase = 'finale') as finali
       from tabelloni tb where tb.id = $1`,
      [tabellone],
    );
    expect(rows[0]).toEqual({ fase_gioco: "finali", finali: 6 });
    const { rows: gironi } = await db.query<{ nome: string; fase: string }>(
      "select nome, fase from gironi where tabellone_id = $1 and fase like 'finale%' order by posizione",
      [tabellone],
    );
    expect(gironi).toEqual([
      { nome: "Finale gold", fase: "finale_gold" },
      { nome: "Finale silver", fase: "finale_silver" },
    ]);

    expect((await errore(genera(tabellone, finali))).hint).toBe(
      "finali_gia_generate",
    );
  });

  it("solo l'admin propone e genera", async () => {
    const { tabellone } = await tabelloneConGironi();
    const giocatore = await createAuthUser(db, { email: "g@example.it" });
    const e = await errore(
      asRole(db, "authenticated", giocatore, () =>
        db.query("select proponi_gironi_gold_silver($1, '[]'::jsonb)", [
          tabellone,
        ]),
      ),
    );
    expect(e.code).toBe("42501");
  });
});
