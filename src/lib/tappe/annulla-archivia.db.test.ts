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
let giocatori: string[];

async function createStage(stato: string, motivo: string | null = null) {
  const { rows } = await db.query<{ id: string }>(
    `insert into tappe (nome, luogo, data_inizio, data_fine, stato, motivo_annullamento)
     values ('Tappa test', 'Spiaggia', '2099-07-01', '2099-07-02', $1, $2)
     returning id`,
    [stato, motivo],
  );
  return rows[0].id;
}

async function board(tappaId: string, categoria: "M" | "F" = "M") {
  const { rows } = await db.query<{ id: string }>(
    "select id from tabelloni where tappa_id = $1 and categoria = $2",
    [tappaId, categoria],
  );
  return rows[0].id;
}

function register(tappaId: string, utenteId: string, tabelloneId: string) {
  return db.query(
    `insert into iscrizioni (tappa_id, tabellone_id, utente_id, stato)
     values ($1, $2, $3, 'in_attesa') returning id`,
    [tappaId, tabelloneId, utenteId],
  );
}

async function stage(id: string) {
  const { rows } = await db.query<{
    stato: string;
    motivo_annullamento: string | null;
    annullata_il: Date | null;
    archiviata_il: Date | null;
  }>(
    "select stato, motivo_annullamento, annullata_il, archiviata_il from tappe where id = $1",
    [id],
  );
  return rows[0];
}

function asAdmin<T>(fn: () => Promise<T>) {
  return asRole(db, "authenticated", admin, fn);
}

function annulla(id: string, motivo: string | null) {
  return db.query<{ email: string; nome: string }>(
    "select * from annulla_tappa($1, $2)",
    [id, motivo],
  );
}

function setStato(id: string, stato: string) {
  return db.query("update tappe set stato = $2 where id = $1", [id, stato]);
}

async function concludiTabelloni(id: string, quanti: "uno" | "entrambi") {
  await db.query(
    `update tabelloni set concluso_il = now()
     where tappa_id = $1 and ($2 = 'entrambi' or categoria = 'M')`,
    [id, quanti],
  );
}

beforeEach(async () => {
  db = await createTestDatabase();
  admin = await createAuthUser(db, { email: "admin@example.it" });
  await db.query("update utenti set ruolo = 'admin' where id = $1", [admin]);
  giocatori = [];
  for (const nome of ["anna", "bruno", "carla", "dario"]) {
    const id = await createAuthUser(db, { email: `${nome}@example.it` });
    await db.query(
      "update auth.users set email_confirmed_at = now() where id = $1",
      [id],
    );
    giocatori.push(id);
  }
});

describe("annullamento della tappa", () => {
  it("annulla con il motivo e restituisce solo gli iscritti da avvisare", async () => {
    const id = await createStage("iscrizioni_chiuse");
    const tabellone = await board(id);
    for (const g of giocatori) await register(id, g, tabellone);
    const stati = ["in_attesa", "confermata", "rifiutata", "ritirata"];
    for (const [i, stato] of stati.entries()) {
      await db.query("update iscrizioni set stato = $2 where utente_id = $1", [
        giocatori[i],
        stato,
      ]);
    }

    const { rows } = await asAdmin(() => annulla(id, "  Allerta meteo  "));
    expect(rows.map((r) => r.email)).toEqual([
      "anna@example.it",
      "bruno@example.it",
    ]);
    const annullata = await stage(id);
    expect(annullata.stato).toBe("annullata");
    expect(annullata.motivo_annullamento).toBe("Allerta meteo");
    expect(annullata.annullata_il).not.toBeNull();
  });

  it.each(["bozza", "iscrizioni_aperte", "iscrizioni_chiuse", "in_corso"])(
    "si annulla da «%s»",
    async (stato) => {
      const id = await createStage(stato);
      await asAdmin(() => annulla(id, "Spiaggia non disponibile"));
      expect((await stage(id)).stato).toBe("annullata");
    },
  );

  it.each([null, "", "   "])("rifiuta il motivo vuoto (%j)", async (motivo) => {
    const id = await createStage("iscrizioni_aperte");
    await expect(asAdmin(() => annulla(id, motivo))).rejects.toMatchObject({
      code: "23514",
      hint: "motivo_mancante",
    });
    expect((await stage(id)).stato).toBe("iscrizioni_aperte");
  });

  it("rifiuta anche un aggiornamento diretto senza motivo", async () => {
    const id = await createStage("iscrizioni_aperte");
    await expect(
      asAdmin(() => setStato(id, "annullata")),
    ).rejects.toMatchObject({ code: "23514" });
  });

  it("una tappa conclusa non si annulla", async () => {
    const id = await createStage("conclusa");
    await expect(
      asAdmin(() => annulla(id, "Troppo tardi")),
    ).rejects.toMatchObject({ code: "23514", hint: "tappa_non_annullabile" });
  });

  it("solo l'admin annulla", async () => {
    const id = await createStage("iscrizioni_aperte");
    await expect(
      asRole(db, "authenticated", giocatori[0], () => annulla(id, "No")),
    ).rejects.toMatchObject({ code: "42501" });
  });

  it("una tappa inesistente dà errore", async () => {
    await expect(
      asAdmin(() => annulla(crypto.randomUUID(), "Motivo")),
    ).rejects.toMatchObject({ hint: "tappa_non_trovata" });
  });

  it("una tappa annullata non cambia più, salvo l'archiviazione", async () => {
    const id = await createStage("iscrizioni_aperte");
    await asAdmin(() => annulla(id, "Maltempo"));
    await expect(
      asAdmin(() =>
        db.query("update tappe set nome = 'Altro' where id = $1", [id]),
      ),
    ).rejects.toMatchObject({ code: "23514", hint: "tappa_annullata" });
    await expect(
      asAdmin(() => setStato(id, "iscrizioni_aperte")),
    ).rejects.toMatchObject({ hint: "tappa_annullata" });
  });
});

describe("blocco delle iscrizioni", () => {
  it("il giocatore non si iscrive a una tappa annullata", async () => {
    const id = await createStage("annullata", "Maltempo");
    const tabellone = await board(id);
    await expect(
      asRole(db, "authenticated", giocatori[0], () =>
        register(id, giocatori[0], tabellone),
      ),
    ).rejects.toMatchObject({ code: "23514", hint: "tappa_annullata" });
  });

  it("nemmeno l'admin o il backend iscrivono a una tappa annullata", async () => {
    const id = await createStage("iscrizioni_aperte");
    await asAdmin(() => annulla(id, "Maltempo"));
    const tabellone = await board(id);
    await expect(
      asAdmin(() => register(id, giocatori[0], tabellone)),
    ).rejects.toMatchObject({ hint: "tappa_annullata" });
    await expect(register(id, giocatori[1], tabellone)).rejects.toMatchObject({
      hint: "tappa_annullata",
    });
  });

  it("le iscrizioni esistenti di una tappa annullata si possono ancora gestire", async () => {
    const id = await createStage("iscrizioni_aperte");
    await register(id, giocatori[0], await board(id));
    await asAdmin(() => annulla(id, "Maltempo"));
    await asAdmin(() =>
      db.query("update iscrizioni set stato = 'ritirata' where tappa_id = $1", [
        id,
      ]),
    );
  });
});

describe("archiviazione", () => {
  it("rifiuta l'archiviazione prima della chiusura di entrambi i tabelloni", async () => {
    const id = await createStage("conclusa");
    await expect(
      asAdmin(() => setStato(id, "archiviata")),
    ).rejects.toMatchObject({ code: "23514", hint: "tabelloni_non_conclusi" });
    await concludiTabelloni(id, "uno");
    await expect(
      asAdmin(() => setStato(id, "archiviata")),
    ).rejects.toMatchObject({ hint: "tabelloni_non_conclusi" });
    expect((await stage(id)).stato).toBe("conclusa");
  });

  it("archivia con entrambi i tabelloni conclusi", async () => {
    const id = await createStage("conclusa");
    await concludiTabelloni(id, "entrambi");
    await asAdmin(() => setStato(id, "archiviata"));
    const archiviata = await stage(id);
    expect(archiviata.stato).toBe("archiviata");
    expect(archiviata.archiviata_il).not.toBeNull();
  });

  it("archivia una tappa annullata e ne tiene il motivo", async () => {
    const id = await createStage("iscrizioni_aperte");
    await asAdmin(() => annulla(id, "Maltempo"));
    await asAdmin(() => setStato(id, "archiviata"));
    const archiviata = await stage(id);
    expect(archiviata.stato).toBe("archiviata");
    expect(archiviata.motivo_annullamento).toBe("Maltempo");
  });

  it("una tappa archiviata è consultabile ma non modificabile", async () => {
    const id = await createStage("conclusa");
    const tabellone = await board(id);
    const { rows } = await register(id, giocatori[0], tabellone);
    await concludiTabelloni(id, "entrambi");
    await asAdmin(() => setStato(id, "archiviata"));

    const bloccata = { code: "23514", hint: "tappa_archiviata" };
    await expect(
      asAdmin(() =>
        db.query("update tappe set nome = 'Altro' where id = $1", [id]),
      ),
    ).rejects.toMatchObject(bloccata);
    await expect(
      asAdmin(() => db.query("delete from tappe where id = $1", [id])),
    ).rejects.toMatchObject(bloccata);
    await expect(
      asAdmin(() =>
        db.query("update iscrizioni set stato = 'confermata' where id = $1", [
          (rows[0] as { id: string }).id,
        ]),
      ),
    ).rejects.toMatchObject(bloccata);
    await expect(
      asAdmin(() => register(id, giocatori[1], tabellone)),
    ).rejects.toMatchObject(bloccata);
    await expect(
      asAdmin(() =>
        db.query("update tabelloni set posti = 8 where id = $1", [tabellone]),
      ),
    ).rejects.toMatchObject(bloccata);
    await expect(
      asAdmin(() =>
        db.query("insert into partite (tabellone_id) values ($1)", [tabellone]),
      ),
    ).rejects.toMatchObject(bloccata);

    // Still readable.
    const lettura = await asRole(db, "anon", null, () =>
      db.query("select id from tappe where id = $1", [id]),
    );
    expect(lettura.rows).toHaveLength(1);
  });

  it("la categoria resta bloccata da una tappa giocata e poi archiviata", async () => {
    const id = await createStage("conclusa");
    await register(id, giocatori[0], await board(id));
    await concludiTabelloni(id, "entrambi");
    await asAdmin(() => setStato(id, "archiviata"));
    const { rows } = await db.query<{ stato: string }>(
      "select stato_categoria($1) as stato",
      [giocatori[0]],
    );
    expect(rows[0].stato).toBe("bloccata");
  });

  it("una tappa annullata e archiviata non blocca la categoria", async () => {
    const id = await createStage("iscrizioni_aperte");
    await register(id, giocatori[0], await board(id));
    await asAdmin(() => annulla(id, "Maltempo"));
    await asAdmin(() => setStato(id, "archiviata"));
    const { rows } = await db.query<{ stato: string }>(
      "select stato_categoria($1) as stato",
      [giocatori[0]],
    );
    expect(rows[0].stato).toBe("modificabile");
  });
});
