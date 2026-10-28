// @vitest-environment node
import { beforeEach, describe, expect, it } from "vitest";
import {
  asRole,
  createAuthUser,
  createTestDatabase,
  type TestDatabase,
} from "@/test/pglite";
import type { PartitaTrovataRow } from "./partite";

let db: TestDatabase;
let admin: string;
let giocatore: string;
let partita: string;
let finale: string;

async function inserisci<T extends Record<string, unknown>>(
  sql: string,
  params: unknown[],
) {
  const { rows } = await db.query<T>(sql, params);
  return rows[0];
}

function cerca(sub: string, parole: string[], limite = 5) {
  return asRole(db, "authenticated", sub, async () => {
    const { rows } = await db.query<PartitaTrovataRow>(
      "select * from public.cerca_partite_admin($1, $2)",
      [parole, limite],
    );
    return rows;
  });
}

beforeEach(async () => {
  db = await createTestDatabase();
  admin = await createAuthUser(db, { email: "admin@blvs.test" });
  await db.query("update utenti set ruolo = 'admin' where id = $1", [admin]);

  const { id: tappa } = await inserisci<{ id: string }>(
    `insert into tappe (nome, luogo, data_inizio, data_fine, stato)
     values ('Tappa 1 · Jesolo', 'Spiaggia', '2027-06-14', '2027-06-15', 'bozza')
     returning id`,
    [],
  );
  const { id: tabellone } = await inserisci<{ id: string }>(
    "select id from tabelloni where tappa_id = $1 and categoria = 'M'",
    [tappa],
  );
  const cognomi = ["Rossi", "Bianchi", "Verdi", "Neri"];
  const iscrizioni: string[] = [];
  for (const [i, cognome] of cognomi.entries()) {
    const id = await createAuthUser(db, {
      email: `g${i}@blvs.test`,
      meta: { nome: i === 0 ? "Niccolò" : "Luca", cognome },
    });
    if (i === 0) giocatore = id;
    const row = await inserisci<{ id: string }>(
      `insert into iscrizioni (tappa_id, tabellone_id, utente_id, stato)
       values ($1, $2, $3, 'confermata') returning id`,
      [tappa, tabellone, id],
    );
    iscrizioni.push(row.id);
  }
  const { id: girone } = await inserisci<{ id: string }>(
    "insert into gironi (tabellone_id, nome) values ($1, 'Girone A') returning id",
    [tabellone],
  );
  partita = (
    await inserisci<{ id: string }>(
      `insert into partite (tabellone_id, girone_id, turno)
       values ($1, $2, 2) returning id`,
      [tabellone, girone],
    )
  ).id;
  finale = (
    await inserisci<{ id: string }>(
      `insert into partite (tabellone_id, fase, turno)
       values ($1, 'finale', 1) returning id`,
      [tabellone],
    )
  ).id;
  for (const [i, iscrizione] of iscrizioni.entries()) {
    await db.query(
      "insert into partita_giocatori (partita_id, iscrizione_id, squadra) values ($1, $2, $3)",
      [partita, iscrizione, i < 2 ? "A" : "B"],
    );
  }
});

describe("cerca_partite_admin", () => {
  it("trova per cognome dei giocatori, con squadre e girone", async () => {
    const rows = await cerca(admin, ["rossi"]);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      partita_id: partita,
      tappa_nome: "Tappa 1 · Jesolo",
      categoria: "M",
      fase: "gironi",
      girone_nome: "Girone A",
      turno: 2,
      sets: [],
    });
    expect(rows[0].squadra_a.map((g) => g.cognome).sort()).toEqual([
      "Bianchi",
      "Rossi",
    ]);
    expect(rows[0].squadra_b).toHaveLength(2);
  });

  it("ogni parola deve comparire: tappa, girone o giocatori", async () => {
    expect(await cerca(admin, ["girone a", "verdi"])).toHaveLength(1);
    expect(await cerca(admin, ["jesolo", "marino"])).toHaveLength(0);
    // The stage name matches the final too (no players yet).
    const tutte = await cerca(admin, ["jesolo"]);
    expect(tutte.map((r) => r.partita_id).sort()).toEqual(
      [partita, finale].sort(),
    );
  });

  it("% e _ non sono jolly; senza parole nessun risultato", async () => {
    expect(await cerca(admin, ["%"])).toHaveLength(0);
    expect(await cerca(admin, ["_"])).toHaveLength(0);
    expect(await cerca(admin, [])).toHaveLength(0);
  });

  it("rispetta il limite", async () => {
    expect(await cerca(admin, ["jesolo"], 1)).toHaveLength(1);
  });

  it("un giocatore non può cercare", async () => {
    await expect(cerca(giocatore, ["rossi"])).rejects.toThrow(
      /Solo l'amministrazione/,
    );
  });
});
