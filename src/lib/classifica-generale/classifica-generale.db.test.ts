// @vitest-environment node
import { beforeEach, describe, expect, it } from "vitest";
import {
  asRole,
  createAuthUser,
  createTestDatabase,
  type TestDatabase,
} from "@/test/pglite";
import { classificaDaDati, type DatiClassificaGenerale } from "./dati";

let db: TestDatabase;
let admin: string;

type PgError = { code?: string; hint?: string };

async function errore(promise: Promise<unknown>): Promise<PgError> {
  try {
    await promise;
  } catch (error) {
    return error as PgError;
  }
  throw new Error("expected an error");
}

async function tappa(stato: string, data = "2026-07-18", nome = "Tappa") {
  const { rows } = await db.query<{ id: string }>(
    `insert into tappe (nome, luogo, data_inizio, data_fine, stato)
     values ($1, 'Spiaggia', $2, $2, $3::stato_tappa) returning id`,
    [nome, data, stato],
  );
  return rows[0].id;
}

async function tabellone(tappaId: string, categoria = "M") {
  const { rows } = await db.query<{ id: string }>(
    "select id from tabelloni where tappa_id = $1 and categoria = $2",
    [tappaId, categoria],
  );
  return rows[0].id;
}

async function iscritto(
  tappaId: string,
  cognome: string,
  stato = "confermata",
): Promise<{ utente: string; iscrizione: string }> {
  const utente = await createAuthUser(db, {
    email: `${cognome}-${crypto.randomUUID()}@example.it`,
  });
  await db.query("update utenti set nome = 'N', cognome = $2 where id = $1", [
    utente,
    cognome,
  ]);
  const { rows } = await db.query<{ id: string }>(
    `insert into iscrizioni (tappa_id, tabellone_id, utente_id, stato)
     values ($1, $2, $3, $4::stato_iscrizione) returning id`,
    [tappaId, await tabellone(tappaId), utente, stato],
  );
  return { utente, iscrizione: rows[0].id };
}

async function girone(tappaId: string, nome: string, fase: string) {
  const { rows } = await db.query<{ id: string }>(
    `insert into gironi (tabellone_id, nome, posizione, fase)
     values ($1, $2, 1, $3) returning id`,
    [await tabellone(tappaId), nome, fase],
  );
  return rows[0].id;
}

/** A concluded match A+B v C+D of `gironeId`, won by A+B. */
async function partita(
  tappaId: string,
  gironeId: string,
  [a, b, c, d]: string[],
  sets: { a: number; b: number }[] = [{ a: 21, b: 15 }],
) {
  const { rows } = await db.query<{ id: string }>(
    `insert into partite (tabellone_id, girone_id, fase, stato)
     values ($1, $2, 'gironi', 'conclusa') returning id`,
    [await tabellone(tappaId), gironeId],
  );
  const id = rows[0].id;
  for (const [i, squadra] of [
    [a, "A"],
    [b, "A"],
    [c, "B"],
    [d, "B"],
  ]) {
    await db.query(
      "insert into partita_giocatori (partita_id, iscrizione_id, squadra) values ($1, $2, $3)",
      [id, i, squadra],
    );
  }
  await db.query(
    "update punteggi set sets = $2::jsonb, versione = versione + 1 where partita_id = $1",
    [id, JSON.stringify(sets)],
  );
  return id;
}

function dati(role: "anon" | "authenticated", stagione: number | null) {
  return asRole(db, role, null, async () => {
    const { rows } = await db.query<{ dati: DatiClassificaGenerale }>(
      "select classifica_generale_dati('M', $1) as dati",
      [stagione],
    );
    return rows[0].dati;
  });
}

beforeEach(async () => {
  db = await createTestDatabase();
  admin = await createAuthUser(db, { email: "admin@example.it" });
  await db.query("update utenti set ruolo = 'admin' where id = $1", [admin]);
});

describe("tappe.stagione", () => {
  it("senza stagione vale l'anno della tappa", async () => {
    const id = await tappa("bozza", "2027-03-01");
    const { rows } = await db.query<{ stagione: number }>(
      "select stagione from tappe where id = $1",
      [id],
    );
    expect(rows[0].stagione).toBe(2027);
  });

  it("solo l'admin la cambia, con un anno valido", async () => {
    const id = await tappa("conclusa");
    const giocatore = await createAuthUser(db, { email: "g@example.it" });
    expect(
      (
        await errore(
          asRole(db, "authenticated", giocatore, () =>
            db.query("select imposta_stagione_tappa($1, 2025)", [id]),
          ),
        )
      ).code,
    ).toBe("42501");
    expect(
      (
        await errore(
          asRole(db, "authenticated", admin, () =>
            db.query("select imposta_stagione_tappa($1, 1999)", [id]),
          ),
        )
      ).hint,
    ).toBe("stagione_non_valida");

    await asRole(db, "authenticated", admin, () =>
      db.query("select imposta_stagione_tappa($1, 2025)", [id]),
    );
    const { rows } = await db.query<{ stagione: number }>(
      "select stagione from tappe where id = $1",
      [id],
    );
    expect(rows[0].stagione).toBe(2025);
  });

  it("una tappa archiviata non cambia stagione", async () => {
    const id = await tappa("conclusa");
    await db.query(
      "update tabelloni set concluso_il = now() where tappa_id = $1",
      [id],
    );
    await db.query("update tappe set stato = 'archiviata' where id = $1", [id]);
    const e = await errore(
      asRole(db, "authenticated", admin, () =>
        db.query("select imposta_stagione_tappa($1, 2025)", [id]),
      ),
    );
    expect(e.hint).toBe("tappa_archiviata");
  });
});

describe("classifica_generale_dati", () => {
  async function tappaConFinale(stato = "in_corso", data = "2026-07-18") {
    const id = await tappa(stato, data, `Tappa ${data}`);
    const gold = await Promise.all(
      ["Uno", "Due", "Tre", "Quattro"].map((c) => iscritto(id, c)),
    );
    const finale = await girone(id, "Finale gold", "finale_gold");
    for (const g of gold) {
      await db.query(
        "insert into girone_iscrizioni (girone_id, iscrizione_id) values ($1, $2)",
        [finale, g.iscrizione],
      );
    }
    const [a, b, c, d] = gold.map((g) => g.iscrizione);
    await partita(id, finale, [a, b, c, d], [{ a: 21, b: 15 }]);
    await partita(id, finale, [a, c, b, d], [{ a: 21, b: 18 }]);
    await partita(id, finale, [a, d, b, c], [{ a: 21, b: 19 }]);

    // Knocked out after one initial match; registered without playing.
    const iniziale = await girone(id, "Girone A", "iniziale");
    const fuori = await Promise.all(
      ["Cinque", "Sei", "Sette", "Otto"].map((c) => iscritto(id, c)),
    );
    await partita(
      id,
      iniziale,
      fuori.map((f) => f.iscrizione),
    );
    const assente = await iscritto(id, "Nove");
    return { id, gold, fuori, assente };
  }

  it("è pubblica: nomi e risultati, mai le email", async () => {
    await tappaConFinale();
    const risposta = await dati("anon", 2026);
    expect(JSON.stringify(risposta)).not.toContain("@example.it");
    expect(risposta.tappe).toHaveLength(1);
    expect(risposta.gironi).toHaveLength(1);
    expect(risposta.partite).toHaveLength(3);
  });

  it("conta chi ha giocato almeno una partita, non chi è solo iscritto", async () => {
    const { gold, fuori, assente } = await tappaConFinale();
    const { iscrizioni } = await dati("anon", 2026);
    const ids = iscrizioni.map((i) => i.id);
    for (const g of [...gold, ...fuori]) expect(ids).toContain(g.iscrizione);
    expect(ids).not.toContain(assente.iscrizione);
  });

  it("esclude bozze e tappe annullate, e filtra per stagione", async () => {
    await tappaConFinale("in_corso", "2026-07-18");
    await tappaConFinale("conclusa", "2025-07-18");
    const annullata = await tappa("iscrizioni_aperte", "2026-08-01");
    await db.query(
      "update tappe set stato = 'annullata', motivo_annullamento = 'Maltempo' where id = $1",
      [annullata],
    );
    await tappa("bozza", "2026-09-01");

    expect((await dati("anon", 2026)).tappe).toHaveLength(1);
    expect((await dati("anon", 2025)).tappe).toHaveLength(1);
    expect((await dati("anon", null)).tappe).toHaveLength(2);

    const stagioni = await asRole(db, "anon", null, async () => {
      const { rows } = await db.query<{ stagioni_classifica: number }>(
        "select * from stagioni_classifica()",
      );
      return rows.map((r) => r.stagioni_classifica);
    });
    expect(stagioni).toEqual([2026, 2025]);
  });

  it("dalla RPC alla classifica: punti della finale, zero agli eliminati, provvisori finché il tabellone è aperto", async () => {
    const { id, gold } = await tappaConFinale();
    let classifica = classificaDaDati(await dati("anon", 2026), "M", 2026);
    const primo = classifica.righe[0];
    expect(primo).toMatchObject({
      utenteId: gold[0].utente,
      punti: 12,
      tappeGiocate: 1,
      puntiProvvisori: true,
    });
    expect(classifica.righe).toHaveLength(8);
    expect(classifica.righe.filter((r) => r.punti === 0)).toHaveLength(4);

    await db.query(
      "update tabelloni set concluso_il = now() where tappa_id = $1",
      [id],
    );
    classifica = classificaDaDati(await dati("anon", 2026), "M", 2026);
    expect(classifica.righe.some((r) => r.puntiProvvisori)).toBe(false);
  });
});
