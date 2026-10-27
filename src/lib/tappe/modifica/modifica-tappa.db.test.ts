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

async function createStage(stato = "iscrizioni_aperte") {
  const { rows } = await db.query<{ id: string }>(
    `insert into tappe (nome, luogo, data_inizio, data_fine, stato, iscrizioni_chiudono_il,
       motivo_annullamento)
     values ('Tappa test', 'Spiaggia', '2099-06-01', '2099-06-02', $1::stato_tappa, '2099-05-20T18:00:00Z',
       case when $1::text = 'annullata' then 'Maltempo' end)
     returning id`,
    [stato],
  );
  return rows[0].id;
}

async function register(tappaId: string, stato = "confermata") {
  const utente = await createAuthUser(db, {
    email: `${crypto.randomUUID()}@example.it`,
  });
  await db.query(
    `insert into iscrizioni (tappa_id, tabellone_id, utente_id, stato)
     select $1, id, $2, $3 from tabelloni where tappa_id = $1 and categoria = 'M'`,
    [tappaId, utente, stato],
  );
}

function modifica(
  sub: string,
  tappaId: string,
  overrides: Partial<{
    versione: number;
    data: string;
    scadenza: string;
    postiM: number;
    postiF: number;
  }> = {},
) {
  const v = {
    versione: 1,
    data: "2099-06-01",
    scadenza: "2099-05-20T18:00:00Z",
    postiM: 16,
    postiF: 16,
    ...overrides,
  };
  return asRole(db, "authenticated", sub, async () => {
    const { rows } = await db.query<{ versione: number }>(
      "select public.modifica_tappa($1, $2, 'Nuovo nome', 'Nuovo luogo', $3, $4, $5, $6) as versione",
      [tappaId, v.versione, v.data, v.scadenza, v.postiM, v.postiF],
    );
    return rows[0].versione;
  });
}

async function posti(tappaId: string) {
  const { rows } = await db.query<{ categoria: string; posti: number }>(
    "select categoria, posti from tabelloni where tappa_id = $1 order by categoria",
    [tappaId],
  );
  return Object.fromEntries(rows.map((r) => [r.categoria, r.posti]));
}

beforeEach(async () => {
  db = await createTestDatabase();
  admin = await createAuthUser(db, { email: "admin@example.it" });
  await db.query("update utenti set ruolo = 'admin' where id = $1", [admin]);
  giocatore = await createAuthUser(db, { email: "marco@example.it" });
});

describe("tappe.versione", () => {
  it("nasce a 1 e cresce di uno a ogni modifica, anche fuori dal modulo", async () => {
    const id = await createStage();
    await db.query(
      "update tappe set stato = 'iscrizioni_chiuse' where id = $1",
      [id],
    );
    await db.query("update tappe set nome = 'Altro' where id = $1", [id]);
    const { rows } = await db.query(
      "select versione from tappe where id = $1",
      [id],
    );
    expect(rows).toEqual([{ versione: 3 }]);
  });
});

describe("modifica_tappa", () => {
  it("salva dati e massimi e restituisce la nuova versione", async () => {
    const id = await createStage();
    expect(
      await modifica(admin, id, { data: "2099-07-10", postiM: 24, postiF: 8 }),
    ).toBe(2);
    const { rows } = await db.query(
      "select nome, luogo, data_inizio::text, data_fine::text from tappe where id = $1",
      [id],
    );
    // The stage moves as a whole: two days stay two days.
    expect(rows).toEqual([
      {
        nome: "Nuovo nome",
        luogo: "Nuovo luogo",
        data_inizio: "2099-07-10",
        data_fine: "2099-07-11",
      },
    ]);
    expect(await posti(id)).toEqual({ M: 24, F: 8 });
  });

  it("con una versione superata rifiuta il salvataggio (conflitto)", async () => {
    const id = await createStage();
    await modifica(admin, id);
    await expect(modifica(admin, id, { postiM: 20 })).rejects.toMatchObject({
      code: "40001",
      hint: "versione_superata",
      detail: "2",
    });
    expect(await posti(id)).toEqual({ M: 16, F: 16 });
  });

  it("il massimo non scende sotto gli iscritti attivi del tabellone", async () => {
    const id = await createStage();
    await register(id, "confermata");
    await register(id, "in_attesa");
    await register(id, "in_attesa");
    await register(id, "ritirata");
    await expect(modifica(admin, id, { postiM: 2 })).rejects.toMatchObject({
      code: "23514",
      hint: "posti_sotto_iscritti",
      detail: "M:3",
      message: "Il massimo non può scendere sotto 3",
    });
    // Nothing is saved: the stage keeps its version and data.
    const { rows } = await db.query(
      "select versione, nome from tappe where id = $1",
      [id],
    );
    expect(rows).toEqual([{ versione: 1, nome: "Tappa test" }]);
    // Equal to the registrations is fine; the F board has none.
    expect(await modifica(admin, id, { postiM: 3, postiF: 4 })).toBe(2);
  });

  it("il blocco vale anche per un update diretto dei posti", async () => {
    const id = await createStage();
    await register(id);
    await register(id);
    await expect(
      db.query(
        "update tabelloni set posti = 1 where tappa_id = $1 and categoria = 'M'",
        [id],
      ),
    ).rejects.toMatchObject({ code: "23514", hint: "posti_sotto_iscritti" });
  });

  it.each(["in_corso", "conclusa", "annullata"])(
    "una tappa %s non si modifica",
    async (stato) => {
      const id = await createStage(stato);
      await expect(modifica(admin, id)).rejects.toMatchObject({
        code: "23514",
        hint: "tappa_non_modificabile",
      });
    },
  );

  it("data passata e scadenza dopo la tappa sono rifiutate", async () => {
    const id = await createStage();
    await expect(
      modifica(admin, id, { data: "2000-01-01" }),
    ).rejects.toMatchObject({
      hint: "data_passata",
    });
    await expect(
      modifica(admin, id, { scadenza: "2099-06-01T10:00:00Z" }),
    ).rejects.toMatchObject({ hint: "scadenza_dopo_tappa" });
    await expect(
      modifica(admin, id, { scadenza: "2001-01-01T10:00:00Z" }),
    ).rejects.toMatchObject({ hint: "scadenza_passata" });
  });

  it("un giocatore non può modificare una tappa", async () => {
    const id = await createStage();
    await expect(modifica(giocatore, id)).rejects.toMatchObject({
      code: "42501",
    });
  });

  it("una tappa inesistente dà no_data_found", async () => {
    await expect(modifica(admin, crypto.randomUUID())).rejects.toMatchObject({
      code: "P0002",
    });
  });

  it("gli iscritti attivi si leggono con iscritti_tabellone", async () => {
    const id = await createStage();
    await register(id, "confermata");
    await register(id, "rifiutata");
    const { rows } = await asRole(db, "authenticated", admin, () =>
      db.query<{ n: number }>(
        "select public.iscritti_tabellone(id) as n from tabelloni where tappa_id = $1 and categoria = 'M'",
        [id],
      ),
    );
    expect(rows).toEqual([{ n: 1 }]);
  });
});
