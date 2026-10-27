// @vitest-environment node
import { beforeEach, describe, expect, it } from "vitest";
import {
  asRole,
  createAuthUser,
  createTestDatabase,
  type TestDatabase,
} from "@/test/pglite";

// The same rules run on the real Postgres of `supabase start` in CI
// (supabase/tests/database/salva_punteggio_coda.test.sql).

let db: TestDatabase;
let admin: string;

type Esito = {
  punteggio: { partita_id: string; sets: unknown; versione: number };
  duplicato: boolean;
};

async function creaPartita(stato = "in_corso") {
  const { rows: tappe } = await db.query<{ id: string }>(
    `insert into tappe (nome, luogo, data_inizio, data_fine, stato)
     values ('Tappa test', 'Spiaggia', '2099-07-01', '2099-07-02', $1::stato_tappa)
     returning id`,
    [stato],
  );
  const { rows } = await db.query<{ id: string }>(
    `insert into partite (tabellone_id, fase, turno)
     select id, 'gironi', 1 from tabelloni
     where tappa_id = $1 and categoria = 'M'
     returning id`,
    [tappe[0].id],
  );
  return { tappa: tappe[0].id, partita: rows[0].id };
}

function salva(
  partita: string,
  versione: number,
  chiave: string,
  { sets = [{ a: 21, b: 18 }], sub = admin } = {},
) {
  return asRole(db, "authenticated", sub, async () => {
    const { rows } = await db.query<{ esito: Esito }>(
      "select salva_punteggio_coda($1, $2, $3::jsonb, $4) as esito",
      [partita, versione, JSON.stringify(sets), chiave],
    );
    return rows[0].esito;
  });
}

async function errore(promise: Promise<unknown>) {
  try {
    await promise;
  } catch (error) {
    return error as { code?: string; hint?: string; detail?: string };
  }
  throw new Error("La chiamata doveva fallire");
}

async function versione(partita: string) {
  const { rows } = await db.query<{ versione: number }>(
    "select versione from punteggi where partita_id = $1",
    [partita],
  );
  return rows[0].versione;
}

beforeEach(async () => {
  db = await createTestDatabase();
  admin = await createAuthUser(db, { email: "admin@example.it" });
  await db.query("update utenti set ruolo = 'admin' where id = $1", [admin]);
});

describe("salva_punteggio_coda", () => {
  it("salva una volta sola anche se la stessa chiave arriva due volte", async () => {
    const { partita } = await creaPartita();
    const chiave = crypto.randomUUID();

    const primo = await salva(partita, 1, chiave);
    expect(primo.duplicato).toBe(false);
    expect(primo.punteggio).toMatchObject({
      versione: 2,
      sets: [{ a: 21, b: 18 }],
    });

    // The response was lost and the device sends again with the version it
    // read before: no 409, no second write.
    const secondo = await salva(partita, 1, chiave);
    expect(secondo.duplicato).toBe(true);
    expect(secondo.punteggio.versione).toBe(2);
    expect(await versione(partita)).toBe(2);

    const { rows } = await db.query<{ n: number }>(
      "select count(*)::int as n from punteggi_invii where chiave = $1",
      [chiave],
    );
    expect(rows[0].n).toBe(1);
  });

  it("scrive l'admin come autore e lascia la riga nel registro", async () => {
    const { partita } = await creaPartita();
    await salva(partita, 1, crypto.randomUUID());
    const { rows } = await db.query<{ autore_id: string }>(
      "select autore_id from punteggi_invii where partita_id = $1",
      [partita],
    );
    expect(rows[0].autore_id).toBe(admin);
    const registro = await db.query<{ attore_id: string }>(
      `select attore_id from registro
       where entita = 'punteggi' and entita_id = $1`,
      [partita],
    );
    expect(registro.rows.map((r) => r.attore_id)).toEqual([admin]);
  });

  it("rifiuta una versione superata con 40001 punteggio_cambiato", async () => {
    const { partita } = await creaPartita();
    await salva(partita, 1, crypto.randomUUID());
    const err = await errore(salva(partita, 1, crypto.randomUUID()));
    expect(err).toMatchObject({
      code: "40001",
      hint: "punteggio_cambiato",
      detail: "2",
    });
    expect(await versione(partita)).toBe(2);
  });

  it("rifiuta una chiave già usata per un'altra partita", async () => {
    const a = await creaPartita();
    const b = await creaPartita();
    const chiave = crypto.randomUUID();
    await salva(a.partita, 1, chiave);
    const err = await errore(salva(b.partita, 1, chiave));
    expect(err).toMatchObject({ code: "23514", hint: "chiave_estranea" });
  });

  it("è riservata all'admin", async () => {
    const { partita } = await creaPartita();
    const giocatore = await createAuthUser(db, { email: "g@example.it" });
    const err = await errore(
      salva(partita, 1, crypto.randomUUID(), { sub: giocatore }),
    );
    expect(err.code).toBe("42501");
    expect(await versione(partita)).toBe(1);
  });

  it("risponde P0002 per una partita inesistente", async () => {
    const err = await errore(
      salva(crypto.randomUUID(), 1, crypto.randomUUID()),
    );
    expect(err.code).toBe("P0002");
  });

  it("non scrive su una tappa archiviata", async () => {
    const { tappa, partita } = await creaPartita();
    await db.query(
      `update tappe set stato = 'annullata', motivo_annullamento = 'Maltempo'
       where id = $1`,
      [tappa],
    );
    await db.query("update tappe set stato = 'archiviata' where id = $1", [
      tappa,
    ]);
    const err = await errore(salva(partita, 1, crypto.randomUUID()));
    expect(err.hint).toBe("tappa_archiviata");
  });
});
