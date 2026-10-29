// @vitest-environment node
import { beforeEach, describe, expect, it } from "vitest";
import {
  asRole,
  createAuthUser,
  createTestDatabase,
  type TestDatabase,
} from "@/test/pglite";

/*
 * Security audit (29/10/2026): what a signed-in player could do by writing
 * straight to the API, and the personal data the registro kept forever.
 */

let db: TestDatabase;
let giocatore: string;
let admin: string;

const MOLTO_TEMPO_FA = "2001-01-01T00:00:00Z";

function recente(valore: Date | string) {
  return Date.now() - new Date(valore).getTime() < 60_000;
}

beforeEach(async () => {
  db = await createTestDatabase();
  giocatore = await createAuthUser(db, {
    email: "mario.rossi@example.it",
    meta: { nome: "Mario", cognome: "Rossi" },
  });
  await db.query(
    "update auth.users set email_confirmed_at = now() where id = $1",
    [giocatore],
  );
  admin = await createAuthUser(db, { email: "admin@example.it" });
  await db.query("update utenti set ruolo = 'admin' where id = $1", [admin]);
});

describe("registro di utenti", () => {
  it("non copia email, nome e cognome: solo ruolo, categoria e se l'email è cambiata", async () => {
    await asRole(db, "authenticated", giocatore, () =>
      db.query("update utenti set categoria = 'F' where id = $1", [giocatore]),
    );
    await asRole(db, "authenticated", admin, () =>
      db.query("update utenti set email = 'nuova@example.it' where id = $1", [
        giocatore,
      ]),
    );

    const { rows } = await db.query<{ dati: Record<string, unknown> }>(
      `select dati from registro
       where entita = 'utenti' and entita_id = $1 order by id`,
      [giocatore],
    );
    expect(rows.map((r) => r.dati)).toEqual([
      {
        prima: { ruolo: "giocatore", categoria: "M" },
        dopo: { ruolo: "giocatore", categoria: "F" },
        email_cambiata: false,
      },
      {
        prima: { ruolo: "giocatore", categoria: "F" },
        dopo: { ruolo: "giocatore", categoria: "F" },
        email_cambiata: true,
      },
    ]);
    const tutto = JSON.stringify(rows);
    for (const dato of ["@example.it", "Mario", "Rossi"])
      expect(tutto).not.toContain(dato);
  });
});

describe("iscrizione scritta direttamente dal giocatore", () => {
  it("posto e date li decide il database, non chi scrive", async () => {
    const { rows: tappe } = await db.query<{ id: string }>(
      `insert into tappe (nome, luogo, data_inizio, data_fine, stato, iscrizioni_chiudono_il)
       values ('Tappa', 'Spiaggia', '2099-06-10', '2099-06-11', 'iscrizioni_aperte', '2099-06-01')
       returning id`,
    );
    const tappa = tappe[0].id;

    const { rows } = await asRole(db, "authenticated", giocatore, () =>
      db.query<{ posto: number; created_at: Date; updated_at: Date }>(
        `insert into iscrizioni (tappa_id, tabellone_id, utente_id, posto, created_at, updated_at)
         select $1, id, $2, 999, $3, $3 from tabelloni where tappa_id = $1 and categoria = 'M'
         returning posto, created_at, updated_at`,
        [tappa, giocatore, MOLTO_TEMPO_FA],
      ),
    );
    expect(rows[0].posto).toBe(1);
    expect(recente(rows[0].created_at)).toBe(true);
    expect(recente(rows[0].updated_at)).toBe(true);
  });

  it("l'admin che aggiunge un iscritto dalla gestione resta com'era", async () => {
    const { rows: tappe } = await db.query<{ id: string }>(
      `insert into tappe (nome, luogo, data_inizio, data_fine, stato)
       values ('Tappa', 'Spiaggia', '2099-06-10', '2099-06-11', 'iscrizioni_chiuse')
       returning id`,
    );
    const { rows } = await asRole(db, "authenticated", admin, () =>
      db.query<{ posto: number }>(
        "select posto from admin_iscrivi_giocatore($1, $2)",
        [tappe[0].id, giocatore],
      ),
    );
    expect(rows[0].posto).toBe(1);
  });
});

describe("consensi e profilo", () => {
  it("un consenso nuovo ha sempre la data di oggi", async () => {
    const { rows } = await asRole(db, "authenticated", giocatore, () =>
      db.query<{ created_at: Date }>(
        `insert into consensi (utente_id, tipo, versione_informativa, concesso, created_at)
         values ($1, 'privacy', '1.0', true, $2) returning created_at`,
        [giocatore, MOLTO_TEMPO_FA],
      ),
    );
    expect(recente(rows[0].created_at)).toBe(true);
  });

  it("la data di creazione del profilo non si cambia dall'API", async () => {
    const { rows: prima } = await db.query<{ created_at: Date }>(
      "select created_at from utenti where id = $1",
      [giocatore],
    );
    await asRole(db, "authenticated", giocatore, () =>
      db.query("update utenti set created_at = $2 where id = $1", [
        giocatore,
        MOLTO_TEMPO_FA,
      ]),
    );
    const { rows: dopo } = await db.query<{ created_at: Date }>(
      "select created_at from utenti where id = $1",
      [giocatore],
    );
    expect(dopo[0].created_at).toEqual(prima[0].created_at);
  });
});
