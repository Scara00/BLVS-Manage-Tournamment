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

type Args = {
  data?: string;
  scadenza?: string;
  postiM?: number;
  postiF?: number;
};

function creaTappa(
  sub: string,
  {
    data = "2099-06-14",
    scadenza = "2099-06-07T23:59:00+02:00",
    postiM = 16,
    postiF = 32,
  }: Args = {},
) {
  return asRole(db, "authenticated", sub, async () => {
    const { rows } = await db.query<{ id: string }>(
      "select public.crea_tappa($1, $2, $3, $4, $5, $6) as id",
      ["Tappa 4 · Lignano", "Lignano, Bagno 3", data, scadenza, postiM, postiF],
    );
    return rows[0].id;
  });
}

beforeEach(async () => {
  db = await createTestDatabase();
  admin = await createAuthUser(db, { email: "admin@example.it" });
  await db.query("update utenti set ruolo = 'admin' where id = $1", [admin]);
  giocatore = await createAuthUser(db, { email: "marco@example.it" });
});

describe("crea_tappa", () => {
  it("crea la tappa in bozza con due tabelloni indipendenti", async () => {
    const id = await creaTappa(admin, { postiM: 16, postiF: 32 });
    const { rows: tappe } = await db.query(
      "select stato, data_inizio::text, data_fine::text from tappe where id = $1",
      [id],
    );
    expect(tappe).toEqual([
      { stato: "bozza", data_inizio: "2099-06-14", data_fine: "2099-06-14" },
    ]);
    const { rows: tabelloni } = await db.query(
      "select categoria, posti from tabelloni where tappa_id = $1 order by categoria",
      [id],
    );
    expect(tabelloni).toEqual([
      { categoria: "M", posti: 16 },
      { categoria: "F", posti: 32 },
    ]);
  });

  it("un giocatore non può creare tappe", async () => {
    await expect(creaTappa(giocatore)).rejects.toMatchObject({
      code: "42501",
    });
    const { rows } = await db.query("select id from tappe");
    expect(rows).toEqual([]);
  });

  it("rifiuta una data passata", async () => {
    await expect(
      creaTappa(admin, {
        data: "2020-01-10",
        scadenza: "2020-01-01T10:00:00Z",
      }),
    ).rejects.toMatchObject({ code: "23514", hint: "data_passata" });
  });

  it("rifiuta una scadenza dalla mezzanotte italiana del giorno della tappa in poi", async () => {
    // 2099-06-14 00:00 a Roma = 2099-06-13 22:00 UTC.
    await expect(
      creaTappa(admin, { scadenza: "2099-06-13T22:00:00Z" }),
    ).rejects.toMatchObject({ code: "23514", hint: "scadenza_dopo_tappa" });
    await expect(
      creaTappa(admin, { scadenza: "2099-06-13T21:59:00Z" }),
    ).resolves.toBeTruthy();
  });

  it("rifiuta un numero di posti fuori intervallo", async () => {
    await expect(creaTappa(admin, { postiM: 2 })).rejects.toMatchObject({
      code: "23514",
    });
  });

  it("il vincolo sulla scadenza vale anche fuori dalla funzione", async () => {
    await expect(
      db.query(
        `insert into tappe (nome, luogo, data_inizio, data_fine, iscrizioni_chiudono_il)
         values ('T', 'L', '2099-06-14', '2099-06-14', '2099-06-14T10:00:00+02:00')`,
      ),
    ).rejects.toMatchObject({ code: "23514" });
  });
});
