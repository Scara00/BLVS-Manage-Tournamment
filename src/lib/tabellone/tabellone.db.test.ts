// @vitest-environment node
import { beforeEach, describe, expect, it } from "vitest";
import {
  asRole,
  createAuthUser,
  createTestDatabase,
  type TestDatabase,
} from "@/test/pglite";
import { datiDaRpc, vistaTabellone, type RpcTabellone } from "./dati";

let db: TestDatabase;
let giocatore: string;

async function tappa(stato: string) {
  const { rows } = await db.query<{ id: string }>(
    `insert into tappe (nome, luogo, data_inizio, data_fine, stato)
     values ('Tappa 1 · Jesolo', 'Spiaggia', '2026-07-18', '2026-07-18', $1::stato_tappa)
     returning id`,
    [stato],
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

async function iscritto(tappaId: string, cognome: string) {
  const utente = await createAuthUser(db, {
    email: `${cognome}-${crypto.randomUUID()}@example.it`,
  });
  await db.query(
    "update utenti set nome = 'Luca', cognome = $2 where id = $1",
    [utente, cognome],
  );
  const { rows } = await db.query<{ id: string }>(
    `insert into iscrizioni (tappa_id, tabellone_id, utente_id, stato)
     values ($1, $2, $3, 'confermata') returning id`,
    [tappaId, await tabellone(tappaId), utente],
  );
  return rows[0].id;
}

/** Stage in progress, one initial group of 4, one match won by A+B. */
async function tappaConGirone() {
  const id = await tappa("in_corso");
  const tb = await tabellone(id);
  await db.query(
    "update tabelloni set fase_gioco = 'gironi_iniziali' where id = $1",
    [tb],
  );
  const iscritti = await Promise.all(
    ["Rossi", "Bianchi", "Verdi", "Neri"].map((c) => iscritto(id, c)),
  );
  const { rows } = await db.query<{ id: string }>(
    `insert into gironi (tabellone_id, nome, posizione, fase)
     values ($1, 'Girone A', 1, 'iniziale') returning id`,
    [tb],
  );
  const girone = rows[0].id;
  for (const i of iscritti) {
    await db.query(
      "insert into girone_iscrizioni (girone_id, iscrizione_id) values ($1, $2)",
      [girone, i],
    );
  }
  const partita = await db.query<{ id: string }>(
    `insert into partite (tabellone_id, girone_id, fase, stato)
     values ($1, $2, 'gironi', 'conclusa') returning id`,
    [tb, girone],
  );
  const [a, b, c, d] = iscritti;
  for (const [i, squadra] of [
    [a, "A"],
    [b, "A"],
    [c, "B"],
    [d, "B"],
  ]) {
    await db.query(
      "insert into partita_giocatori (partita_id, iscrizione_id, squadra) values ($1, $2, $3)",
      [partita.rows[0].id, i, squadra],
    );
  }
  await db.query(
    `update punteggi set sets = '[{"a":21,"b":15}]'::jsonb, versione = versione + 1
     where partita_id = $1`,
    [partita.rows[0].id],
  );
  return { id, tb, iscritti };
}

function leggi(role: "anon" | "authenticated", tappaId: string) {
  return asRole(db, role, role === "anon" ? null : giocatore, async () => {
    const { rows } = await db.query<{ dati: RpcTabellone | null }>(
      "select tabellone_giocatore_dati($1) as dati",
      [tappaId],
    );
    return rows[0].dati;
  });
}

beforeEach(async () => {
  db = await createTestDatabase();
  giocatore = await createAuthUser(db, { email: "giocatore@example.it" });
});

describe("tabellone_giocatore_dati", () => {
  it("un giocatore legge gironi, nomi e risultati, mai le email", async () => {
    const { id, iscritti } = await tappaConGirone();
    const dati = await leggi("authenticated", id);
    expect(dati).not.toBeNull();
    expect(JSON.stringify(dati)).not.toContain("@example.it");
    expect(dati!.tappa.stato).toBe("in_corso");
    expect(dati!.gironi).toHaveLength(1);
    expect(dati!.membri).toHaveLength(4);
    expect(dati!.nomi.map((n) => n.cognome).sort()).toEqual([
      "Bianchi",
      "Neri",
      "Rossi",
      "Verdi",
    ]);

    const stage = vistaTabellone(datiDaRpc(dati!), {
      updatedAt: "2026-07-18T10:00:00Z",
    });
    const board = stage.boards.find((b) => b.categoria === "M")!;
    expect(board.fase).toBe("gironi_iniziali");
    const [girone] = board.gironi;
    // Its only match is concluded: BLVS-27 counts the group as finished.
    expect(girone.stato).toBe("completo");
    expect(girone.taglio?.dopo).toBe(2);
    expect(girone.rows[0]).toMatchObject({ position: 1, played: 1, won: 1 });
    expect(iscritti.slice(0, 2)).toContain(girone.rows[0].playerId);
    expect(girone.rows[0].name).toMatch(/^Luca (Rossi|Bianchi)$/);
  });

  it("chiuso il tabellone, la fase è «Conclusa»", async () => {
    const { id, tb } = await tappaConGirone();
    await db.query(
      "update tabelloni set fase_gioco = 'finali', concluso_il = now() where id = $1",
      [tb],
    );
    const dati = await leggi("authenticated", id);
    expect(
      dati!.tabelloni.find((t) => t.id === tb)?.concluso_il,
    ).not.toBeNull();
    const stage = vistaTabellone(datiDaRpc(dati!), {
      updatedAt: "2026-07-18T10:00:00Z",
    });
    expect(stage.boards.find((b) => b.categoria === "M")?.fase).toBe(
      "conclusa",
    );
  });

  it("una bozza o una tappa inesistente: null", async () => {
    const id = await tappa("bozza");
    expect(await leggi("authenticated", id)).toBeNull();
    expect(await leggi("authenticated", crypto.randomUUID())).toBeNull();
  });

  it("solo per chi ha fatto l'accesso", async () => {
    const { id } = await tappaConGirone();
    await expect(leggi("anon", id)).rejects.toMatchObject({ code: "42501" });
  });
});
