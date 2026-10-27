// @vitest-environment node
import { beforeEach, describe, expect, it } from "vitest";
import {
  asRole,
  createAuthUser,
  createTestDatabase,
  type TestDatabase,
} from "@/test/pglite";
import { classificaGirone, type PartitaGirone } from "./classifica";
import { toPartitaGirone, type PartitaGironeRow } from "./dati";

let db: TestDatabase;
let admin: string;
let giocatore: string;
let tappa: string;
let girone: string;
/** Registration ids of anna, bruno, carla, dario. */
let iscrizioni: string[];

async function insertMatch(A: string[], B: string[], sets: [number, number][]) {
  const {
    rows: [{ id }],
  } = await db.query<{ id: string }>(
    `insert into partite (tabellone_id, girone_id, stato)
     select tabellone_id, id, 'conclusa' from gironi where id = $1
     returning id`,
    [girone],
  );
  for (const [squadra, ids] of [
    ["A", A],
    ["B", B],
  ] as const) {
    for (const iscrizione of ids) {
      await db.query(
        "insert into partita_giocatori (partita_id, iscrizione_id, squadra) values ($1, $2, $3)",
        [id, iscrizione, squadra],
      );
    }
  }
  await db.query(
    "update punteggi set sets = $2::jsonb, versione = versione + 1 where partita_id = $1",
    [id, JSON.stringify(sets.map(([a, b]) => ({ a, b })))],
  );
}

/** The group's matches in the shape the PostgREST embed returns. */
async function partiteGirone(): Promise<PartitaGirone[]> {
  const { rows } = await db.query<PartitaGironeRow>(
    `select p.id, p.stato,
       (select jsonb_build_object('sets', s.sets) from punteggi s where s.partita_id = p.id) as punteggi,
       coalesce((select jsonb_agg(jsonb_build_object('iscrizione_id', pg.iscrizione_id, 'squadra', pg.squadra))
         from partita_giocatori pg where pg.partita_id = p.id), '[]'::jsonb) as partita_giocatori
     from partite p where p.girone_id = $1`,
    [girone],
  );
  return rows.map(toPartitaGirone);
}

async function firmaAperta() {
  const classifica = classificaGirone(iscrizioni, await partiteGirone());
  expect(classifica.stato).toBe("da_risolvere");
  return classifica.parita[0];
}

function risolvi(
  firma: string,
  ordine: string[],
  motivo: string | null = "Sorteggio",
) {
  return db.query(
    "select * from risolvi_parita_girone($1, $2, $3::uuid[], $4)",
    [girone, firma, ordine, motivo],
  );
}

const asAdmin = <T>(fn: () => Promise<T>) =>
  asRole(db, "authenticated", admin, fn);

beforeEach(async () => {
  db = await createTestDatabase();
  admin = await createAuthUser(db, { email: "admin@example.it" });
  await db.query("update utenti set ruolo = 'admin' where id = $1", [admin]);

  const {
    rows: [stage],
  } = await db.query<{ id: string }>(
    `insert into tappe (nome, luogo, data_inizio, data_fine, stato)
     values ('Tappa test', 'Spiaggia', '2099-07-01', '2099-07-02', 'in_corso')
     returning id`,
  );
  tappa = stage.id;
  const {
    rows: [g],
  } = await db.query<{ id: string }>(
    `insert into gironi (tabellone_id, nome)
     select id, 'Girone A' from tabelloni where tappa_id = $1 and categoria = 'M'
     returning id`,
    [tappa],
  );
  girone = g.id;

  iscrizioni = [];
  for (const nome of ["anna", "bruno", "carla", "dario"]) {
    const utente = await createAuthUser(db, { email: `${nome}@example.it` });
    if (nome === "anna") giocatore = utente;
    const {
      rows: [i],
    } = await db.query<{ id: string }>(
      `insert into iscrizioni (tappa_id, tabellone_id, utente_id, stato)
       select $1, id, $2, 'confermata' from tabelloni where tappa_id = $1 and categoria = 'M'
       returning id`,
      [tappa, utente],
    );
    iscrizioni.push(i.id);
    await db.query(
      "insert into girone_iscrizioni (girone_id, iscrizione_id) values ($1, $2)",
      [girone, i.id],
    );
  }

  // King of the court: each pair once, every match 21-19. Anna, Bruno and
  // Carla end on 2 wins, +2 and 61 points each: a perfect three-way tie.
  const [a, b, c, d] = iscrizioni;
  await insertMatch([a, b], [c, d], [[21, 19]]);
  await insertMatch([a, c], [b, d], [[21, 19]]);
  await insertMatch([b, c], [a, d], [[21, 19]]);
});

describe("risolvi_parita_girone", () => {
  it("l'admin decide l'ordine e la classifica si sblocca", async () => {
    const tie = await firmaAperta();
    expect(tie.iscrizioni).toHaveLength(3);
    const [a, b, c, d] = iscrizioni;
    const ordine = [c, a, b];

    await asAdmin(() => risolvi(tie.firma, ordine, "  Sorteggio in campo  "));

    const { rows } = await db.query<{
      ordine: string[];
      motivo: string;
      deciso_da: string;
    }>(
      "select ordine, motivo, deciso_da from spareggi_girone where girone_id = $1",
      [girone],
    );
    expect(rows).toEqual([
      { ordine, motivo: "Sorteggio in campo", deciso_da: admin },
    ]);

    const decisioni = (
      await db.query<{ firma: string; ordine: string[] }>(
        "select firma, ordine from spareggi_girone where girone_id = $1",
        [girone],
      )
    ).rows;
    const classifica = classificaGirone(iscrizioni, await partiteGirone(), {
      decisioni,
    });
    expect(classifica.stato).toBe("completo");
    expect(classifica.righe.map((r) => r.iscrizioneId)).toEqual([c, a, b, d]);

    const registro = await db.query(
      "select 1 from registro where entita = 'spareggi_girone' and attore_id = $1",
      [admin],
    );
    expect(registro.rows).toHaveLength(1);
  });

  it("una seconda decisione sulla stessa parità la sostituisce", async () => {
    const { firma } = await firmaAperta();
    const [a, b, c] = iscrizioni;
    await asAdmin(() => risolvi(firma, [a, b, c]));
    await asAdmin(() => risolvi(firma, [b, a, c], "Ripetuto il sorteggio"));
    const { rows } = await db.query<{ ordine: string[]; motivo: string }>(
      "select ordine, motivo from spareggi_girone",
    );
    expect(rows).toEqual([
      { ordine: [b, a, c], motivo: "Ripetuto il sorteggio" },
    ]);
  });

  it("un giocatore non può decidere, ma tutti leggono le decisioni", async () => {
    const { firma } = await firmaAperta();
    const [a, b, c] = iscrizioni;
    await expect(
      asRole(db, "authenticated", giocatore, () => risolvi(firma, [a, b, c])),
    ).rejects.toMatchObject({ code: "42501" });
    await expect(
      asRole(db, "anon", null, () => risolvi(firma, [a, b, c])),
    ).rejects.toMatchObject({ code: "42501" });

    await asAdmin(() => risolvi(firma, [a, b, c]));
    const letti = await asRole(db, "anon", null, () =>
      db.query("select firma from spareggi_girone"),
    );
    expect(letti.rows).toHaveLength(1);
    await expect(
      asRole(db, "authenticated", giocatore, () =>
        db.query("delete from spareggi_girone returning id"),
      ),
    ).resolves.toMatchObject({ rows: [] });
  });

  it.each([
    ["manca un giocatore pari", (a: string, b: string) => [a, b]],
    ["un giocatore due volte", (a: string, b: string) => [a, b, a]],
    [
      "un giocatore non pari",
      (a: string, b: string, _c: string, d: string) => [a, b, d],
    ],
    [
      "un'iscrizione di un altro girone",
      (a: string, b: string) => [a, b, "00000000-0000-4000-8000-00000000ffff"],
    ],
  ])("rifiuta un ordine non valido: %s", async (_nome, ordine) => {
    const { firma } = await firmaAperta();
    const [a, b, c, d] = iscrizioni;
    await expect(
      asAdmin(() => risolvi(firma, ordine(a, b, c, d))),
    ).rejects.toMatchObject({ code: "23514", hint: "ordine_non_valido" });
  });

  it("rifiuta una firma illeggibile o senza motivo", async () => {
    const { firma } = await firmaAperta();
    const [a, b, c] = iscrizioni;
    await expect(
      asAdmin(() => risolvi("non-una-firma", [a, b, c])),
    ).rejects.toMatchObject({
      hint: "ordine_non_valido",
    });
    await expect(
      asAdmin(() => risolvi(firma, [a, b, c], "   ")),
    ).rejects.toMatchObject({
      code: "23514",
      hint: "motivo_mancante",
    });
  });

  it("non si decide più su una tappa archiviata", async () => {
    const { firma } = await firmaAperta();
    const [a, b, c] = iscrizioni;
    await db.query(
      "update tappe set stato = 'annullata', motivo_annullamento = 'Meteo' where id = $1",
      [tappa],
    );
    await db.query("update tappe set stato = 'archiviata' where id = $1", [
      tappa,
    ]);
    await expect(
      asAdmin(() => risolvi(firma, [a, b, c])),
    ).rejects.toMatchObject({
      code: "23514",
      hint: "tappa_archiviata",
    });
  });
});
