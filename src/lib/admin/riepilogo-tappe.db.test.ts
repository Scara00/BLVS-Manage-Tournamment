// @vitest-environment node
import { beforeEach, describe, expect, it } from "vitest";
import {
  asRole,
  createAuthUser,
  createTestDatabase,
  type TestDatabase,
} from "@/test/pglite";
import type { AdminTappaRpcRow } from "./tappe";

let db: TestDatabase;
let admin: string;
let giocatori: string[];

async function createStage(nome: string, stato: string) {
  const { rows } = await db.query<{ id: string }>(
    `insert into tappe (nome, luogo, data_inizio, data_fine, stato)
     values ($1, 'Spiaggia', '2027-06-14', '2027-06-15', $2)
     returning id`,
    [nome, stato],
  );
  return rows[0].id;
}

async function board(tappaId: string, categoria: "M" | "F") {
  const { rows } = await db.query<{ id: string }>(
    "select id from tabelloni where tappa_id = $1 and categoria = $2",
    [tappaId, categoria],
  );
  return rows[0].id;
}

async function register(tappaId: string, utenteId: string, stato: string) {
  await db.query(
    `insert into iscrizioni (tappa_id, tabellone_id, utente_id, stato)
     values ($1, $2, $3, $4)`,
    [tappaId, await board(tappaId, "M"), utenteId, stato],
  );
}

async function match(
  tappaId: string,
  stato: string,
  programmataIl: string | null,
  sets: unknown[] = [],
) {
  const { rows } = await db.query<{ id: string }>(
    `insert into partite (tabellone_id, stato, programmata_il)
     values ($1, $2, $3) returning id`,
    [await board(tappaId, "M"), stato, programmataIl],
  );
  if (sets.length > 0) {
    await db.query(
      "update punteggi set sets = $2, versione = versione + 1 where partita_id = $1",
      [rows[0].id, JSON.stringify(sets)],
    );
  }
}

function riepilogo(sub: string) {
  return asRole(db, "authenticated", sub, async () => {
    const { rows } = await db.query<AdminTappaRpcRow>(
      "select * from public.admin_riepilogo_tappe()",
    );
    return rows;
  });
}

beforeEach(async () => {
  db = await createTestDatabase();
  admin = await createAuthUser(db, { email: "admin@blvs.test" });
  await db.query("update utenti set ruolo = 'admin' where id = $1", [admin]);
  giocatori = [];
  for (let i = 0; i < 4; i++) {
    giocatori.push(
      await createAuthUser(db, { email: `g${i}@blvs.test`, categoria: "M" }),
    );
  }
});

describe("tabelloni: posti e fase", () => {
  it("ogni tabellone nasce con 16 posti e senza fase", async () => {
    const tappa = await createStage("Tappa", "bozza");
    const { rows } = await db.query<{ posti: number; fase: string | null }>(
      "select posti, fase from tabelloni where tappa_id = $1",
      [tappa],
    );
    expect(rows).toEqual([
      { posti: 16, fase: null },
      { posti: 16, fase: null },
    ]);
  });

  it("accetta solo gold o silver e posti tra 1 e 256", async () => {
    const tappa = await createStage("Tappa", "bozza");
    const id = await board(tappa, "M");
    await db.query(
      "update tabelloni set fase = 'gold', posti = 24 where id = $1",
      [id],
    );
    await expect(
      db.query("update tabelloni set fase = 'bronze' where id = $1", [id]),
    ).rejects.toThrow(/tabelloni_fase/);
    await expect(
      db.query("update tabelloni set posti = 0 where id = $1", [id]),
    ).rejects.toThrow(/tabelloni_posti/);
  });
});

describe("admin_riepilogo_tappe()", () => {
  it("l'admin vede anche le bozze, con iscritti e posti per categoria", async () => {
    const bozza = await createStage("Bozza", "bozza");
    const aperta = await createStage("Aperta", "iscrizioni_aperte");
    await db.query(
      "update tabelloni set posti = 8, fase = 'gold' where tappa_id = $1 and categoria = 'M'",
      [aperta],
    );
    await register(aperta, giocatori[0], "in_attesa");
    await register(aperta, giocatori[1], "confermata");
    await register(aperta, giocatori[2], "rifiutata");
    await register(aperta, giocatori[3], "ritirata");

    const rows = await riepilogo(admin);
    expect(rows.map((r) => r.nome).sort()).toEqual(["Aperta", "Bozza"]);
    const row = rows.find((r) => r.id === aperta)!;
    expect(row.categorie).toEqual([
      { categoria: "M", posti: 8, fase: "gold", concluso: false, iscritti: 2 },
      { categoria: "F", posti: 16, fase: null, concluso: false, iscritti: 0 },
    ]);
    expect(rows.find((r) => r.id === bozza)!.stato).toBe("bozza");
  });

  it("conta le partite in corso o oltre l'orario senza punteggio", async () => {
    const tappa = await createStage("In gara", "in_corso");
    await match(tappa, "in_corso", null, [{ a: 10, b: 8 }]);
    await match(tappa, "programmata", "2000-01-01T09:00:00Z");
    await match(tappa, "programmata", "2000-01-01T10:00:00Z", [
      { a: 21, b: 19 },
    ]);
    await match(tappa, "programmata", "2999-01-01T10:00:00Z");
    await match(tappa, "programmata", null);
    await match(tappa, "conclusa", "2000-01-01T08:00:00Z");
    await match(tappa, "annullata", "2000-01-01T08:00:00Z");

    const [row] = await riepilogo(admin);
    expect(row.partite_da_inserire).toBe(2);
  });

  it("un giocatore riceve 42501", async () => {
    await createStage("Aperta", "iscrizioni_aperte");
    await expect(riepilogo(giocatori[0])).rejects.toMatchObject({
      code: "42501",
    });
  });

  it("anon non può eseguirla", async () => {
    await expect(
      asRole(db, "anon", null, () =>
        db.query("select * from public.admin_riepilogo_tappe()"),
      ),
    ).rejects.toThrow(/permission denied/);
  });
});
