// @vitest-environment node
import { beforeAll, describe, expect, it } from "vitest";
import {
  asRole,
  createAuthUser,
  createTestDatabase,
  type TestDatabase,
} from "@/test/pglite";
import { TIPI_EVENTO_REGISTRO } from "./eventi";

// The same rules run on the real Postgres of `supabase start` in CI
// (supabase/tests/database/registro_eventi.test.sql).

let db: TestDatabase;
let adminId: string;
let giocatoreId: string;

async function expectPgError(promise: Promise<unknown>, code: string) {
  await expect(promise).rejects.toMatchObject({ code });
}

const SCRIVI = `select * from registra_evento(
  $1::tipo_evento_registro, 'punteggi', '42',
  '{"set1": [21, 18]}', '{"set1": [21, 19]}', 'Errore di battitura', $2
)`;

beforeAll(async () => {
  db = await createTestDatabase();
  adminId = await createAuthUser(db, { email: "admin@example.it" });
  giocatoreId = await createAuthUser(db, { email: "giocatore@example.it" });
  await db.query("update utenti set ruolo = 'admin' where id = $1", [adminId]);
});

describe("registro degli eventi di gara", () => {
  it("accetta tutti i tipi di evento richiesti", async () => {
    const { rows } = await db.query<{ v: string }>(
      "select unnest(enum_range(null::tipo_evento_registro))::text as v",
    );
    expect(rows.map((r) => r.v)).toEqual([...TIPI_EVENTO_REGISTRO]);
  });

  it("ogni voce ha tipo, autore, data e ora, oggetto, valore prima e dopo", async () => {
    const { rows } = await db.query<Record<string, unknown>>(SCRIVI, [
      "correzione_punteggio",
      adminId,
    ]);
    expect(rows[0]).toMatchObject({
      tipo: "correzione_punteggio",
      azione: "evento",
      attore_id: adminId,
      entita: "punteggi",
      entita_id: "42",
      valore_prima: { set1: [21, 18] },
      valore_dopo: { set1: [21, 19] },
      nota: "Errore di battitura",
    });
    const { rows: ora } = await db.query<{ ok: boolean }>(
      `select ora_roma = (created_at at time zone 'Europe/Rome') as ok
       from registro where id = $1`,
      [rows[0].id],
    );
    expect(ora[0].ok).toBe(true);
  });

  it("rifiuta un evento senza autore", async () => {
    await expectPgError(db.query(SCRIVI, ["ritiro", null]), "23502");
  });

  it("con una sessione l'autore è l'admin, non quello passato", async () => {
    const { rows } = await asRole(db, "authenticated", adminId, () =>
      db.query<{ attore_id: string }>(SCRIVI, ["assenza", giocatoreId]),
    );
    expect(rows[0].attore_id).toBe(adminId);
  });

  it("un giocatore non può scrivere eventi", async () => {
    await asRole(db, "authenticated", giocatoreId, () =>
      expectPgError(db.query(SCRIVI, ["ritiro", null]), "42501"),
    );
  });

  it("una voce non si può modificare, cancellare né svuotare (TRUNCATE)", async () => {
    const before = await db.query("select * from registro order by id");
    await expectPgError(
      db.query("update registro set nota = 'cambiata' where tipo is not null"),
      "42501",
    );
    await expectPgError(
      db.query("delete from registro where tipo is not null"),
      "42501",
    );
    await expectPgError(db.query("truncate registro"), "42501");
    await asRole(db, "authenticated", adminId, () =>
      expectPgError(db.query("update registro set nota = 'x'"), "42501"),
    );
    const after = await db.query("select * from registro order by id");
    expect(after.rows).toEqual(before.rows);
  });
});
