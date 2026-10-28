// @vitest-environment node
import { beforeEach, describe, expect, it } from "vitest";
import {
  asRole,
  createAuthUser,
  createTestDatabase,
  type TestDatabase,
} from "@/test/pglite";
import { REGOLA_ANNULLAMENTO, scadenzaAnnullamento } from "./regola";

let db: TestDatabase;

type DbError = {
  code?: string;
  hint?: string;
  detail?: string;
  message: string;
};

async function createStage({
  stato = "iscrizioni_aperte",
  chiudono = "2099-06-01 23:59+02",
  annullabile = null,
  inizio = "2099-06-10",
  posti = 16,
}: {
  stato?: string;
  chiudono?: string | null;
  annullabile?: string | null;
  inizio?: string;
  posti?: number;
} = {}) {
  const { rows } = await db.query<{ id: string }>(
    `insert into tappe (nome, luogo, data_inizio, data_fine, stato, iscrizioni_chiudono_il)
     values ('Tappa test', 'Spiaggia', $2::date, $2::date + 1, $1::stato_tappa, $3)
     returning id`,
    [stato, inizio, chiudono],
  );
  const id = rows[0].id;
  await db.query("update tabelloni set posti = $2 where tappa_id = $1", [
    id,
    posti,
  ]);
  if (annullabile !== null)
    await db.query("update tappe set annullabile_fino_al = $2 where id = $1", [
      id,
      annullabile,
    ]);
  return id;
}

async function createPlayer(categoria: "M" | "F" = "M") {
  const id = await createAuthUser(db, {
    email: `${crypto.randomUUID()}@example.it`,
    categoria,
  });
  await db.query(
    "update auth.users set email_confirmed_at = now() where id = $1",
    [id],
  );
  return id;
}

function iscriviti(utente: string, tappa: string) {
  return asRole(db, "authenticated", utente, async () => {
    try {
      const { rows } = await db.query<{ id: string; posto: number }>(
        "select * from public.iscriviti_tappa($1)",
        [tappa],
      );
      return { ok: true as const, row: rows[0] };
    } catch (error) {
      return { ok: false as const, error: error as DbError };
    }
  });
}

function annulla(utente: string, iscrizione: string) {
  return asRole(db, "authenticated", utente, async () => {
    try {
      const { rows } = await db.query<{
        iscrizione_id: string;
        posto: number;
        posti: number;
        occupati: number;
      }>("select * from public.annulla_iscrizione($1)", [iscrizione]);
      return { ok: true as const, row: rows[0] };
    } catch (error) {
      return { ok: false as const, error: error as DbError };
    }
  });
}

function tabelloneM(utente: string, tappa: string) {
  return asRole(db, "authenticated", utente, async () => {
    const { rows } = await db.query<{
      categoria: string;
      occupati: number;
      prossimo_posto: number | null;
    }>("select * from public.tabelloni_tappa($1)", [tappa]);
    return rows.find((r) => r.categoria === "M");
  });
}

async function iscritto(tappa: string) {
  const utente = await createPlayer();
  const esito = await iscriviti(utente, tappa);
  if (!esito.ok) throw new Error(esito.error.message);
  return { utente, iscrizione: esito.row.id, posto: esito.row.posto };
}

beforeEach(async () => {
  db = await createTestDatabase();
});

describe("regola_annullamento (Q-09)", () => {
  it("è la stessa regola di REGOLA_ANNULLAMENTO", async () => {
    const { rows } = await db.query<{ ripiego: string }>(
      "select * from regola_annullamento()",
    );
    expect(rows[0].ripiego).toBe(REGOLA_ANNULLAMENTO.ripiego);
  });

  it("scadenza_annullamento() calcola la stessa scadenza del TS", async () => {
    const casi = [
      { annullabile: "2099-06-05 23:59+02", chiudono: "2099-06-01 23:59+02" },
      { annullabile: null, chiudono: "2099-06-01 23:59+02" },
      { annullabile: null, chiudono: null, inizio: "2099-06-10" },
      { annullabile: null, chiudono: null, inizio: "2099-01-10" },
    ];
    for (const caso of casi) {
      const tappa = await createStage({
        stato: "iscrizioni_chiuse",
        ...caso,
      });
      const { rows } = await db.query<{
        s: Date;
        data_inizio: string;
        iscrizioni_chiudono_il: Date | null;
        annullabile_fino_al: Date | null;
      }>(
        `select scadenza_annullamento(id) as s, data_inizio::text,
           iscrizioni_chiudono_il, annullabile_fino_al
         from tappe where id = $1`,
        [tappa],
      );
      const r = rows[0];
      expect(r.s.toISOString()).toBe(
        scadenzaAnnullamento({
          data_inizio: r.data_inizio,
          iscrizioni_chiudono_il:
            r.iscrizioni_chiudono_il?.toISOString() ?? null,
          annullabile_fino_al: r.annullabile_fino_al?.toISOString() ?? null,
        }),
      );
    }
  });
});

describe("annulla_iscrizione(): liberazione del posto", () => {
  it("annulla la propria iscrizione: il posto torna libero e i contatori scendono", async () => {
    const tappa = await createStage();
    const a = await iscritto(tappa);
    const b = await iscritto(tappa);
    expect([a.posto, b.posto]).toEqual([1, 2]);
    expect(await tabelloneM(a.utente, tappa)).toMatchObject({
      occupati: 2,
      prossimo_posto: 3,
    });

    const esito = await annulla(a.utente, a.iscrizione);
    expect(esito).toMatchObject({
      ok: true,
      row: { iscrizione_id: a.iscrizione, posto: 1, posti: 16, occupati: 1 },
    });
    expect(await tabelloneM(a.utente, tappa)).toMatchObject({
      occupati: 1,
      prossimo_posto: 1,
    });

    // The next player takes the freed seat.
    const c = await iscritto(tappa);
    expect(c.posto).toBe(1);

    const { rows } = await db.query<{ stato: string; posto: number }>(
      "select stato, posto from iscrizioni where id = $1",
      [a.iscrizione],
    );
    expect(rows[0]).toEqual({ stato: "ritirata", posto: 1 });
  });

  it("scrive l'evento annullamento_iscrizione nel registro", async () => {
    const tappa = await createStage();
    const a = await iscritto(tappa);
    await annulla(a.utente, a.iscrizione);
    const { rows } = await db.query<{
      attore_id: string;
      entita: string;
      valore_prima: { stato: string; posto: number; tappa_id: string };
      valore_dopo: { stato: string; tappa_id: string };
      nota: string;
    }>(
      `select attore_id, entita, valore_prima, valore_dopo, nota from registro
       where tipo = 'annullamento_iscrizione' and entita_id = $1`,
      [a.iscrizione],
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      attore_id: a.utente,
      entita: "iscrizioni",
      valore_prima: { stato: "in_attesa", posto: 1, tappa_id: tappa },
      valore_dopo: { stato: "ritirata", tappa_id: tappa },
      nota: "Annullata dal giocatore",
    });
  });

  it("dopo la scadenza (orario del server) rifiuta con scadenza_superata", async () => {
    const tappa = await createStage({ stato: "iscrizioni_aperte" });
    const a = await iscritto(tappa);
    await db.query(
      "update tappe set annullabile_fino_al = now() - interval '1 second' where id = $1",
      [tappa],
    );
    const esito = await annulla(a.utente, a.iscrizione);
    expect(esito).toMatchObject({
      ok: false,
      error: { code: "23514", hint: "scadenza_superata" },
    });
    expect(esito.ok ? "" : esito.error.detail).toMatch(/^\d{4}-\d\d-\d\dT/);
    expect(await tabelloneM(a.utente, tappa)).toMatchObject({ occupati: 1 });
  });

  it("prima della scadenza annulla anche con le iscrizioni chiuse", async () => {
    const tappa = await createStage();
    const a = await iscritto(tappa);
    await db.query(
      `update tappe set stato = 'iscrizioni_chiuse',
         annullabile_fino_al = now() + interval '1 hour' where id = $1`,
      [tappa],
    );
    expect(await annulla(a.utente, a.iscrizione)).toMatchObject({ ok: true });
  });

  it("non si annulla l'iscrizione di un altro (P0002) né una già annullata", async () => {
    const tappa = await createStage();
    const a = await iscritto(tappa);
    const altro = await createPlayer();
    expect(await annulla(altro, a.iscrizione)).toMatchObject({
      ok: false,
      error: { code: "P0002" },
    });
    await annulla(a.utente, a.iscrizione);
    expect(await annulla(a.utente, a.iscrizione)).toMatchObject({
      ok: false,
      error: { hint: "non_attiva" },
    });
  });

  it("rifiuta una tappa iniziata o un giocatore già in un girone", async () => {
    const tappa = await createStage();
    const a = await iscritto(tappa);
    const b = await iscritto(tappa);
    const { rows } = await db.query<{ id: string }>(
      `insert into gironi (tabellone_id, nome, posizione)
       select id, 'Girone A', 1 from tabelloni where tappa_id = $1 and categoria = 'M'
       returning id`,
      [tappa],
    );
    await db.query(
      "insert into girone_iscrizioni (girone_id, iscrizione_id) values ($1, $2)",
      [rows[0].id, a.iscrizione],
    );
    expect(await annulla(a.utente, a.iscrizione)).toMatchObject({
      ok: false,
      error: { hint: "in_girone" },
    });

    await db.query(
      "update tappe set stato = 'iscrizioni_chiuse' where id = $1",
      [tappa],
    );
    await db.query("update tappe set stato = 'in_corso' where id = $1", [
      tappa,
    ]);
    expect(await annulla(b.utente, b.iscrizione)).toMatchObject({
      ok: false,
      error: { hint: "tappa_iniziata" },
    });
  });
});

describe("iscriviti_tappa() dopo un annullamento", () => {
  it("chi ha annullato prende di nuovo un posto", async () => {
    const tappa = await createStage();
    const a = await iscritto(tappa);
    await iscritto(tappa);
    await annulla(a.utente, a.iscrizione);
    const di_nuovo = await iscriviti(a.utente, tappa);
    expect(di_nuovo).toMatchObject({ ok: true, row: { posto: 1 } });
    const { rows } = await db.query<{ n: number }>(
      "select count(*)::int as n from iscrizioni where utente_id = $1",
      [a.utente],
    );
    expect(rows[0].n).toBe(1);
  });

  it("se la nuova iscrizione è rifiutata la riga annullata resta", async () => {
    const tappa = await createStage({ posti: 5 });
    const a = await iscritto(tappa);
    await annulla(a.utente, a.iscrizione);
    for (let i = 0; i < 5; i++) await iscritto(tappa);
    expect(await iscriviti(a.utente, tappa)).toMatchObject({
      ok: false,
      error: { hint: "posti_esauriti" },
    });
    const { rows } = await db.query<{ stato: string }>(
      "select stato from iscrizioni where id = $1",
      [a.iscrizione],
    );
    expect(rows[0].stato).toBe("ritirata");
  });

  it("una rimozione dell'admin non si scavalca: resta «già iscritto»", async () => {
    const tappa = await createStage();
    const a = await iscritto(tappa);
    await db.query("update iscrizioni set stato = 'ritirata' where id = $1", [
      a.iscrizione,
    ]);
    expect(await iscriviti(a.utente, tappa)).toMatchObject({
      ok: false,
      error: { hint: "gia_iscritto" },
    });
  });
});
