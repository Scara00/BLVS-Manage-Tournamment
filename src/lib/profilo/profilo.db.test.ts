// @vitest-environment node
import { beforeEach, describe, expect, it } from "vitest";
import {
  asRole,
  createAuthUser,
  createTestDatabase,
  type TestDatabase,
} from "@/test/pglite";

let db: TestDatabase;
let giocatore: string;

async function createStage(stato: string) {
  const { rows } = await db.query<{ id: string }>(
    `insert into tappe (nome, luogo, data_inizio, data_fine, stato)
     values ('Tappa test', 'Spiaggia', '2027-06-01', '2027-06-02', $1)
     returning id`,
    [stato],
  );
  return rows[0].id;
}

async function register(utenteId: string, tappaStato: string, stato: string) {
  const tappaId = await createStage("iscrizioni_aperte");
  await db.query(
    `insert into iscrizioni (tappa_id, tabellone_id, utente_id, stato)
     select $1, id, $2, $3 from tabelloni where tappa_id = $1 and categoria = 'M'`,
    [tappaId, utenteId, stato],
  );
  // BLVS-22: a stage is cancelled only with a reason.
  await db.query(
    `update tappe set stato = $2::stato_tappa,
       motivo_annullamento = case when $2::text = 'annullata' then 'Maltempo' end
     where id = $1`,
    [tappaId, tappaStato],
  );
  return tappaId;
}

function changeCategory(sub: string, utenteId: string, categoria: "M" | "F") {
  return asRole(db, "authenticated", sub, () =>
    db.query("update utenti set categoria = $2 where id = $1", [
      utenteId,
      categoria,
    ]),
  );
}

async function categoryOf(id: string) {
  const { rows } = await db.query<{ categoria: string }>(
    "select categoria from utenti where id = $1",
    [id],
  );
  return rows[0].categoria;
}

function statoCategoria(sub: string, utenteId: string) {
  return asRole(db, "authenticated", sub, async () => {
    const { rows } = await db.query<{ stato: string }>(
      "select public.stato_categoria($1) as stato",
      [utenteId],
    );
    return rows[0].stato;
  });
}

beforeEach(async () => {
  db = await createTestDatabase();
  giocatore = await createAuthUser(db, { email: "marco@example.it" });
});

describe("categoria: blocco lato server", () => {
  it("senza tappe giocate il giocatore cambia la propria categoria", async () => {
    await changeCategory(giocatore, giocatore, "F");
    expect(await categoryOf(giocatore)).toBe("F");
    expect(await statoCategoria(giocatore, giocatore)).toBe("modificabile");
  });

  it.each(["in_corso", "conclusa"])(
    "dopo una tappa %s il server rifiuta il cambio",
    async (statoTappa) => {
      await register(giocatore, statoTappa, "confermata");
      expect(await statoCategoria(giocatore, giocatore)).toBe("bloccata");
      await expect(
        changeCategory(giocatore, giocatore, "F"),
      ).rejects.toMatchObject({ code: "23514", hint: "categoria_bloccata" });
      expect(await categoryOf(giocatore)).toBe("M");
    },
  );

  it("un'iscrizione ritirata o rifiutata non blocca la categoria", async () => {
    await register(giocatore, "conclusa", "ritirata");
    await register(giocatore, "in_corso", "rifiutata");
    expect(await statoCategoria(giocatore, giocatore)).toBe("modificabile");
    await changeCategory(giocatore, giocatore, "F");
    expect(await categoryOf(giocatore)).toBe("F");
  });

  it("con un'iscrizione attiva a una tappa futura il cambio è rifiutato", async () => {
    await register(giocatore, "iscrizioni_aperte", "in_attesa");
    expect(await statoCategoria(giocatore, giocatore)).toBe(
      "iscrizione_attiva",
    );
    await expect(
      changeCategory(giocatore, giocatore, "F"),
    ).rejects.toMatchObject({ code: "23514", hint: "iscrizione_attiva" });
  });

  it("un'iscrizione a una tappa annullata non conta", async () => {
    await register(giocatore, "annullata", "confermata");
    expect(await statoCategoria(giocatore, giocatore)).toBe("modificabile");
  });

  it("nome e cognome restano modificabili a categoria bloccata", async () => {
    await register(giocatore, "conclusa", "confermata");
    await asRole(db, "authenticated", giocatore, () =>
      db.query(
        "update utenti set nome = 'Marco', cognome = 'Rossi', categoria = 'M' where id = $1",
        [giocatore],
      ),
    );
    const { rows } = await db.query("select nome, cognome from utenti");
    expect(rows).toEqual([{ nome: "Marco", cognome: "Rossi" }]);
  });

  it("l'admin può sempre correggere la categoria", async () => {
    const admin = await createAuthUser(db, { email: "admin@example.it" });
    await db.query("update utenti set ruolo = 'admin' where id = $1", [admin]);
    await register(giocatore, "conclusa", "confermata");
    expect(await statoCategoria(admin, giocatore)).toBe("bloccata");
    await changeCategory(admin, giocatore, "F");
    expect(await categoryOf(giocatore)).toBe("F");
  });

  it("un giocatore non legge lo stato della categoria di un altro", async () => {
    const altro = await createAuthUser(db, { email: "luca@example.it" });
    await expect(statoCategoria(giocatore, altro)).rejects.toMatchObject({
      code: "42501",
    });
  });
});

describe("email: unicità e riconferma", () => {
  it("il giocatore non può scrivere direttamente la propria email", async () => {
    await expect(
      asRole(db, "authenticated", giocatore, () =>
        db.query("update utenti set email = 'nuova@example.it' where id = $1", [
          giocatore,
        ]),
      ),
    ).rejects.toMatchObject({ code: "42501" });
  });

  it("l'email del profilo cambia solo quando Auth conferma il cambio", async () => {
    await db.query(
      "update auth.users set email = 'nuova@example.it' where id = $1",
      [giocatore],
    );
    const { rows } = await db.query("select email from utenti where id = $1", [
      giocatore,
    ]);
    expect(rows).toEqual([{ email: "nuova@example.it" }]);
  });

  it("la nuova email non può essere quella di un altro account", async () => {
    await createAuthUser(db, { email: "Luca@Example.it" });
    await expect(
      db.query(
        "update auth.users set email = 'luca@example.it' where id = $1",
        [giocatore],
      ),
    ).rejects.toMatchObject({ code: "23505" });
  });
});
