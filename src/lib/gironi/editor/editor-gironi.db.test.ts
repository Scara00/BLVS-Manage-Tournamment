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
let giocatore: string;
let tabellone: string;
let iscrizioni: string[];
let gironi: string[];

async function setup() {
  const { rows } = await db.query<{ id: string }>(
    `insert into tappe (nome, luogo, data_inizio, data_fine, stato, iscrizioni_chiudono_il)
     values ('Tappa test', 'Spiaggia', '2099-06-01', '2099-06-02', 'iscrizioni_chiuse', '2099-05-20T18:00:00Z')
     returning id`,
  );
  const tappa = rows[0].id;
  tabellone = (
    await db.query<{ id: string }>(
      "select id from tabelloni where tappa_id = $1 and categoria = 'M'",
      [tappa],
    )
  ).rows[0].id;
  iscrizioni = [];
  for (let i = 0; i < 9; i += 1) {
    const utente = await createAuthUser(db, {
      email: `g${i}@example.it`,
      meta: { nome: "Giocatore", cognome: String.fromCharCode(65 + i) },
    });
    await db.query(
      "update utenti set nome = 'Giocatore', cognome = $2 where id = $1",
      [utente, String.fromCharCode(65 + i)],
    );
    const { rows: r } = await db.query<{ id: string }>(
      `insert into iscrizioni (tappa_id, tabellone_id, utente_id, stato)
       values ($1, $2, $3, 'confermata') returning id`,
      [tappa, tabellone, utente],
    );
    iscrizioni.push(r[0].id);
  }
  gironi = [];
  for (const nome of ["Girone A", "Girone B"]) {
    const { rows: r } = await db.query<{ id: string }>(
      "insert into gironi (tabellone_id, nome, posizione) values ($1, $2, $3) returning id",
      [tabellone, nome, gironi.length + 1],
    );
    gironi.push(r[0].id);
  }
  // A: 0-3, B: 4-7, 8 not assigned.
  for (let i = 0; i < 8; i += 1) {
    await db.query(
      "insert into girone_iscrizioni (girone_id, iscrizione_id) values ($1, $2)",
      [gironi[i < 4 ? 0 : 1], iscrizioni[i]],
    );
  }
}

function rpc<T = number>(sub: string, sql: string, params: unknown[]) {
  return asRole(db, "authenticated", sub, async () => {
    const { rows } = await db.query<{ r: T }>(`select ${sql} as r`, params);
    return rows[0].r;
  });
}

type Editor = {
  versione: number;
  bloccata: boolean;
  gironi: {
    id: string;
    nome: string;
    giocatori: { iscrizione_id: string; nome: string }[];
  }[];
  non_assegnati: { iscrizione_id: string; nome: string }[];
};

const leggi = () => rpc<Editor>(admin, "public.gironi_editor($1)", [tabellone]);
const membri = (e: Editor, i: number) =>
  e.gironi[i].giocatori.map((g) => iscrizioni.indexOf(g.iscrizione_id));

async function partita(girone: string, stato = "programmata") {
  await db.query(
    "insert into partite (tabellone_id, girone_id, stato) values ($1, $2, $3::stato_partita)",
    [tabellone, girone, stato],
  );
}

beforeEach(async () => {
  db = await createTestDatabase();
  admin = await createAuthUser(db, { email: "admin@example.it" });
  await db.query("update utenti set ruolo = 'admin' where id = $1", [admin]);
  giocatore = await createAuthUser(db, { email: "marco@example.it" });
  await setup();
});

describe("gironi_editor", () => {
  it("legge gironi, giocatori, non assegnati e versione", async () => {
    const e = await leggi();
    expect(e.versione).toBe(0);
    expect(e.bloccata).toBe(false);
    expect(e.gironi.map((g) => g.nome)).toEqual(["Girone A", "Girone B"]);
    expect(membri(e, 0)).toEqual([0, 1, 2, 3]);
    expect(e.gironi[0].giocatori[0].nome).toBe("Giocatore A");
    expect(e.non_assegnati.map((g) => g.nome)).toEqual(["Giocatore I"]);
  });

  it("è riservata agli admin", async () => {
    await expect(
      rpc(giocatore, "public.gironi_editor($1)", [tabellone]),
    ).rejects.toMatchObject({ code: "42501" });
  });
});

describe("spostamento", () => {
  it("sposta un giocatore e alza la versione", async () => {
    const v = await rpc(admin, "public.sposta_in_girone($1, 0, $2, $3)", [
      tabellone,
      iscrizioni[0],
      gironi[1],
    ]);
    expect(v).toBe(1);
    const e = await leggi();
    expect(membri(e, 0)).toEqual([1, 2, 3]);
    expect(membri(e, 1)).toEqual([0, 4, 5, 6, 7]);
  });

  it("toglie dai gironi con null e rimette dentro un non assegnato", async () => {
    await rpc(admin, "public.sposta_in_girone($1, 0, $2, null)", [
      tabellone,
      iscrizioni[1],
    ]);
    await rpc(admin, "public.sposta_in_girone($1, 1, $2, $3)", [
      tabellone,
      iscrizioni[8],
      gironi[0],
    ]);
    const e = await leggi();
    expect(membri(e, 0)).toEqual([0, 2, 3, 8]);
    expect(
      e.non_assegnati.map((g) => iscrizioni.indexOf(g.iscrizione_id)),
    ).toEqual([1]);
  });

  it("con una versione superata risponde 40001", async () => {
    await expect(
      rpc(admin, "public.sposta_in_girone($1, 5, $2, $3)", [
        tabellone,
        iscrizioni[0],
        gironi[1],
      ]),
    ).rejects.toMatchObject({
      code: "40001",
      hint: "versione_superata",
      detail: "0",
    });
  });

  it("rifiuta iscrizioni di altri tabelloni o non confermate", async () => {
    await db.query("update iscrizioni set stato = 'ritirata' where id = $1", [
      iscrizioni[8],
    ]);
    await expect(
      rpc(admin, "public.sposta_in_girone($1, 0, $2, $3)", [
        tabellone,
        iscrizioni[8],
        gironi[0],
      ]),
    ).rejects.toMatchObject({ code: "23514", hint: "iscrizione_estranea" });
  });

  it("un giocatore non può farlo", async () => {
    await expect(
      rpc(giocatore, "public.sposta_in_girone($1, 0, $2, $3)", [
        tabellone,
        iscrizioni[0],
        gironi[1],
      ]),
    ).rejects.toMatchObject({ code: "42501" });
  });
});

describe("scambio", () => {
  it("scambia due giocatori di gironi diversi", async () => {
    await rpc(admin, "public.scambia_in_girone($1, 0, $2, $3)", [
      tabellone,
      iscrizioni[0],
      iscrizioni[4],
    ]);
    const e = await leggi();
    expect(membri(e, 0)).toEqual([1, 2, 3, 4]);
    expect(membri(e, 1)).toEqual([0, 5, 6, 7]);
  });

  it("scambia con un non assegnato", async () => {
    await rpc(admin, "public.scambia_in_girone($1, 0, $2, $3)", [
      tabellone,
      iscrizioni[8],
      iscrizioni[0],
    ]);
    const e = await leggi();
    expect(membri(e, 0)).toEqual([1, 2, 3, 8]);
    expect(
      e.non_assegnati.map((g) => iscrizioni.indexOf(g.iscrizione_id)),
    ).toEqual([0]);
  });

  it("nello stesso girone non cambia nulla, nemmeno la versione", async () => {
    expect(
      await rpc(admin, "public.scambia_in_girone($1, 0, $2, $3)", [
        tabellone,
        iscrizioni[0],
        iscrizioni[1],
      ]),
    ).toBe(0);
  });
});

describe("aggiunta ed eliminazione", () => {
  it("aggiunge il girone con il primo nome libero", async () => {
    await rpc(admin, "public.elimina_girone($1, 0, $2)", [
      tabellone,
      gironi[0],
    ]);
    await rpc(admin, "public.aggiungi_girone($1, 1)", [tabellone]);
    const e = await leggi();
    expect(e.gironi.map((g) => g.nome)).toEqual(["Girone B", "Girone A"]);
    expect(e.non_assegnati).toHaveLength(5);
    expect(e.versione).toBe(2);
  });
});

describe("partite", () => {
  it("elimina le partite programmate dei soli gironi toccati", async () => {
    await partita(gironi[0]);
    await partita(gironi[1]);
    await rpc(admin, "public.sposta_in_girone($1, 0, $2, null)", [
      tabellone,
      iscrizioni[0],
    ]);
    const { rows } = await db.query<{ girone_id: string }>(
      "select girone_id from partite where tabellone_id = $1",
      [tabellone],
    );
    expect(rows).toEqual([{ girone_id: gironi[1] }]);
  });

  it("con una partita dei gironi iniziata i gironi sono bloccati", async () => {
    await partita(gironi[1], "in_corso");
    expect((await leggi()).bloccata).toBe(true);
    await expect(
      rpc(admin, "public.sposta_in_girone($1, 0, $2, null)", [
        tabellone,
        iscrizioni[0],
      ]),
    ).rejects.toMatchObject({ code: "23514", hint: "gironi_non_modificabili" });
    await expect(
      rpc(admin, "public.aggiungi_girone($1, 0)", [tabellone]),
    ).rejects.toMatchObject({
      hint: "gironi_non_modificabili",
    });
  });
});
