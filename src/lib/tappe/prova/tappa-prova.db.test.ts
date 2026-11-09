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

type DbError = { code?: string; hint?: string; message: string };

async function errore(promise: Promise<unknown>): Promise<DbError> {
  try {
    await promise;
  } catch (error) {
    return error as DbError;
  }
  throw new Error("La chiamata doveva fallire");
}

const comeAdmin = <T>(fn: () => Promise<T>) =>
  asRole(db, "authenticated", admin, fn);
const comeGiocatore = <T>(fn: () => Promise<T>) =>
  asRole(db, "authenticated", giocatore, fn);

/** A draft with 4 confirmed men (backend inserts, no checks). */
async function bozzaConIscritti() {
  const { rows } = await db.query<{ id: string }>(
    `insert into tappe (nome, luogo, data_inizio, data_fine, stato)
     values ('Prova', 'Spiaggia', '2099-06-10', '2099-06-10', 'bozza')
     returning id`,
  );
  const tappa = rows[0].id;
  const { rows: tb } = await db.query<{ id: string }>(
    "select id from tabelloni where tappa_id = $1 and categoria = 'M'",
    [tappa],
  );
  for (let i = 0; i < 4; i++) {
    const utente = await createAuthUser(db, {
      email: `${crypto.randomUUID()}@example.it`,
      categoria: "M",
    });
    await db.query(
      `insert into iscrizioni (tappa_id, tabellone_id, utente_id, stato)
       values ($1, $2, $3, 'confermata')`,
      [tappa, tb[0].id, utente],
    );
  }
  return { tappa, tabellone: tb[0].id };
}

const prova = (tappa: string, valore: boolean) =>
  db.query<{ v: boolean }>("select admin_imposta_tappa_prova($1, $2) as v", [
    tappa,
    valore,
  ]);

const stato = async (tappa: string) =>
  (
    await db.query<{ stato: string }>("select stato from tappe where id = $1", [
      tappa,
    ])
  ).rows[0].stato;

beforeEach(async () => {
  db = await createTestDatabase();
  admin = await createAuthUser(db, { email: "admin@example.it" });
  await db.query("update utenti set ruolo = 'admin' where id = $1", [admin]);
  giocatore = await createAuthUser(db, { email: "g@example.it" });
});

describe("tappa di prova", () => {
  it("senza prova una bozza non genera i gironi, come prima", async () => {
    const { tappa } = await bozzaConIscritti();
    const e = await errore(
      comeAdmin(() => db.query("select * from genera_gironi($1)", [tappa])),
    );
    expect(e.hint).toBe("iscrizioni_non_chiuse");
  });

  it("in prova la bozza si gioca tutta e resta una bozza", async () => {
    const { tappa, tabellone } = await bozzaConIscritti();
    expect((await comeAdmin(() => prova(tappa, true))).rows[0].v).toBe(true);

    await comeAdmin(() => db.query("select * from genera_gironi($1)", [tappa]));
    const avviate = await comeAdmin(() =>
      db.query<{ turno: number }>("select * from avvia_fase($1)", [tabellone]),
    );
    expect(avviate.rows.map((r) => r.turno)).toEqual([1, 2, 3]);
    expect(await stato(tappa)).toBe("bozza");

    const { rows: partite } = await db.query<{ id: string }>(
      "select id from partite where tabellone_id = $1 order by turno",
      [tabellone],
    );
    // Come fa la gestione live: la partita va in corso, poi parziale e punteggio.
    await comeAdmin(() =>
      db.query("update partite set stato = 'in_corso' where id = $1", [
        partite[0].id,
      ]),
    );
    // Spenta la prova, lo stesso parziale si ferma sullo stato della tappa.
    await comeAdmin(() => prova(tappa, false));
    const spenta = await errore(
      comeAdmin(() =>
        db.query("select * from salva_parziale($1, 0, 10, 8)", [partite[0].id]),
      ),
    );
    expect(spenta.hint).toBe("partita_non_in_corso");
    await comeAdmin(() => prova(tappa, true));
    await comeAdmin(() =>
      db.query("select * from salva_parziale($1, 0, 10, 8)", [partite[0].id]),
    );
    const salvato = await comeAdmin(() =>
      db.query<{ versione: number }>(
        "select * from salva_punteggio($1, 1, 21, 15)",
        [partite[0].id],
      ),
    );
    expect(salvato.rows[0].versione).toBeGreaterThan(0);

    // Le finali e la chiusura passano il controllo dello stato: si fermano
    // per la fase, non perché la tappa «non è in corso».
    const finali = await errore(
      comeAdmin(() =>
        db.query("select * from genera_finali($1, '[]'::jsonb)", [tabellone]),
      ),
    );
    expect(finali.hint).not.toBe("tappa_non_avviabile");
    const chiusura = await errore(
      comeAdmin(() =>
        db.query("select * from concludi_tabellone($1)", [tabellone]),
      ),
    );
    expect(chiusura.hint).not.toBe("tappa_non_in_corso");
    expect(await stato(tappa)).toBe("bozza");
  });

  it("i giocatori non la vedono; l'admin ne legge anche il tabellone", async () => {
    const { tappa } = await bozzaConIscritti();
    await comeAdmin(() => prova(tappa, true));
    await comeAdmin(() => db.query("select * from genera_gironi($1)", [tappa]));

    const visibile = await comeGiocatore(() =>
      db.query("select id from tappe where id = $1", [tappa]),
    );
    expect(visibile.rows).toHaveLength(0);
    const daGiocatore = await comeGiocatore(() =>
      db.query<{ d: unknown }>("select tabellone_giocatore_dati($1) as d", [
        tappa,
      ]),
    );
    expect(daGiocatore.rows[0].d).toBeNull();
    const daAdmin = await comeAdmin(() =>
      db.query<{
        d: { gironi: unknown[]; tappa: { stato: string } } | null;
      }>("select tabellone_giocatore_dati($1) as d", [tappa]),
    );
    expect(daAdmin.rows[0].d?.gironi).toHaveLength(1);
    // The player pages show it as a stage in progress.
    expect(daAdmin.rows[0].d?.tappa.stato).toBe("in_corso");
  });

  it("si accende solo su una bozza, solo da admin; spenta torna una bozza", async () => {
    const { tappa } = await bozzaConIscritti();
    expect((await errore(comeGiocatore(() => prova(tappa, true)))).code).toBe(
      "42501",
    );
    await comeAdmin(() => prova(tappa, true));
    await comeAdmin(() => prova(tappa, false));
    const e = await errore(
      comeAdmin(() => db.query("select * from genera_gironi($1)", [tappa])),
    );
    expect(e.hint).toBe("iscrizioni_non_chiuse");

    await db.query(
      "update tappe set stato = 'iscrizioni_chiuse' where id = $1",
      [tappa],
    );
    expect((await errore(comeAdmin(() => prova(tappa, true)))).hint).toBe(
      "prova_solo_bozza",
    );
  });

  it("stato_di_gioco: solo una bozza di prova si gioca come in corso", async () => {
    const { rows } = await db.query<{ a: string; b: string; c: string }>(
      `select stato_di_gioco('bozza', true) as a,
              stato_di_gioco('bozza', false) as b,
              stato_di_gioco('iscrizioni_aperte', true) as c`,
    );
    expect(rows[0]).toEqual({
      a: "in_corso",
      b: "bozza",
      c: "iscrizioni_aperte",
    });
  });
});
