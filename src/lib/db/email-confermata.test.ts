// @vitest-environment node
import { beforeEach, describe, expect, it } from "vitest";
import {
  asRole,
  createAuthUser,
  createTestDatabase,
  type TestDatabase,
} from "@/test/pglite";

/** BLVS-15: the database refuses a stage sign-up until the email is confirmed. */
let db: TestDatabase;
let tappa: string;
let tabelloneM: string;

beforeEach(async () => {
  db = await createTestDatabase();
  const { rows } = await db.query<{ id: string }>(
    `insert into tappe (nome, luogo, data_inizio, data_fine, stato)
     values ('Tappa test', 'Spiaggia', '2027-06-01', '2027-06-02', 'iscrizioni_aperte')
     returning id`,
  );
  tappa = rows[0].id;
  const board = await db.query<{ id: string }>(
    "select id from tabelloni where tappa_id = $1 and categoria = 'M'",
    [tappa],
  );
  tabelloneM = board.rows[0].id;
});

async function confirm(id: string) {
  await db.query(
    "update auth.users set email_confirmed_at = now() where id = $1",
    [id],
  );
}

function signUpAs(utente: string) {
  return asRole(db, "authenticated", utente, () =>
    db.query(
      "insert into iscrizioni (tappa_id, tabellone_id, utente_id) values ($1, $2, $3)",
      [tappa, tabelloneM, utente],
    ),
  );
}

describe("iscrizione e conferma email", () => {
  it("rifiuta l'iscrizione di chi non ha confermato l'email", async () => {
    const giocatore = await createAuthUser(db, { email: "nuovo@example.it" });
    await expect(signUpAs(giocatore)).rejects.toMatchObject({
      code: "42501",
      message: "Conferma la tua email prima di iscriverti a una tappa",
    });
    const { rows } = await db.query("select 1 from iscrizioni");
    expect(rows).toHaveLength(0);
  });

  it("accetta l'iscrizione dopo la conferma", async () => {
    const giocatore = await createAuthUser(db, { email: "nuovo@example.it" });
    await confirm(giocatore);
    await signUpAs(giocatore);
    const { rows } = await db.query<{ utente_id: string }>(
      "select utente_id from iscrizioni",
    );
    expect(rows).toEqual([{ utente_id: giocatore }]);
  });

  it("email_confermata() risponde per l'utente connesso", async () => {
    const giocatore = await createAuthUser(db, { email: "nuovo@example.it" });
    const read = () =>
      asRole(db, "authenticated", giocatore, async () => {
        const { rows } = await db.query<{ ok: boolean }>(
          "select public.email_confermata() as ok",
        );
        return rows[0].ok;
      });
    expect(await read()).toBe(false);
    await confirm(giocatore);
    expect(await read()).toBe(true);
  });

  it("un admin iscrive anche un giocatore non ancora confermato", async () => {
    const admin = await createAuthUser(db, {
      email: "admin@example.it",
      categoria: null,
    });
    await db.query("update utenti set ruolo = 'admin' where id = $1", [admin]);
    const giocatore = await createAuthUser(db, { email: "nuovo@example.it" });
    await asRole(db, "authenticated", admin, () =>
      db.query(
        "insert into iscrizioni (tappa_id, tabellone_id, utente_id) values ($1, $2, $3)",
        [tappa, tabelloneM, giocatore],
      ),
    );
    const { rows } = await db.query("select 1 from iscrizioni");
    expect(rows).toHaveLength(1);
  });

  it("i visitatori non possono interrogare lo stato di conferma", async () => {
    await expect(
      asRole(db, "anon", null, () =>
        db.query("select public.email_confermata()"),
      ),
    ).rejects.toMatchObject({ code: "42501" });
  });
});
