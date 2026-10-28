// @vitest-environment node
import { beforeEach, describe, expect, it } from "vitest";
import {
  classificaDaDati,
  type DatiClassificaGenerale,
} from "@/lib/classifica-generale/dati";
import {
  asRole,
  createAuthUser,
  createTestDatabase,
  type TestDatabase,
} from "@/test/pglite";
import type { EffettiRpc } from "./effetti";

let db: TestDatabase;
let admin: string;

type PgError = { code?: string; hint?: string; detail?: string };

async function errore(promise: Promise<unknown>): Promise<PgError> {
  try {
    await promise;
  } catch (error) {
    return error as PgError;
  }
  throw new Error("expected an error");
}

async function tappa(stato: string, data = "2027-07-04", posti = 16) {
  const { rows } = await db.query<{ id: string }>(
    `insert into tappe (nome, luogo, data_inizio, data_fine, stato)
     values ('Tappa ' || $1, 'Spiaggia', $1::date, $1::date, $2::stato_tappa) returning id`,
    [data, stato],
  );
  await db.query("update tabelloni set posti = $2 where tappa_id = $1", [
    rows[0].id,
    posti,
  ]);
  return rows[0].id;
}

async function tabellone(tappaId: string, categoria: string) {
  const { rows } = await db.query<{ id: string }>(
    "select id from tabelloni where tappa_id = $1 and categoria = $2",
    [tappaId, categoria],
  );
  return rows[0].id;
}

async function giocatore(cognome: string, categoria: "M" | "F" = "M") {
  const id = await createAuthUser(db, {
    email: `${cognome}-${crypto.randomUUID()}@example.it`,
    categoria,
  });
  await db.query("update utenti set nome = 'N', cognome = $2 where id = $1", [
    id,
    cognome,
  ]);
  return id;
}

async function iscrivi(
  tappaId: string,
  utente: string,
  categoria: string,
  stato = "confermata",
) {
  const { rows } = await db.query<{ id: string; posto: number }>(
    `insert into iscrizioni (tappa_id, tabellone_id, utente_id, stato)
     values ($1, $2, $3, $4::stato_iscrizione) returning id, posto`,
    [tappaId, await tabellone(tappaId, categoria), utente, stato],
  );
  return rows[0];
}

const comeAdmin = <T>(fn: () => Promise<T>) =>
  asRole(db, "authenticated", admin, fn);

async function effetti(utente: string, categoria: string): Promise<EffettiRpc> {
  return comeAdmin(async () => {
    const { rows } = await db.query<{ e: EffettiRpc }>(
      "select effetti_cambio_categoria($1, $2::categoria) as e",
      [utente, categoria],
    );
    return rows[0].e;
  });
}

const attesi = (e: EffettiRpc) =>
  JSON.stringify(
    e.iscrizioni.map((i) => ({
      iscrizione_id: i.iscrizione_id,
      posto_dopo: i.posto_dopo,
    })),
  );

async function cambia(
  utente: string,
  categoria: string,
  atteso: string,
  nota: string | null = null,
) {
  const { rows } = await db.query<{ r: Record<string, unknown> }>(
    "select admin_cambia_categoria($1, $2::categoria, $3::jsonb, $4) as r",
    [utente, categoria, atteso, nota],
  );
  return rows[0].r;
}

beforeEach(async () => {
  db = await createTestDatabase();
  admin = await createAuthUser(db, {
    email: "admin@example.it",
    categoria: null,
  });
  await db.query("update utenti set ruolo = 'admin' where id = $1", [admin]);
});

describe("categoria da verificare", () => {
  it("un nuovo giocatore è da verificare; solo l'admin la verifica", async () => {
    const luca = await giocatore("Rossi");
    const { rows } = await db.query(
      "select categoria_verificata_il from utenti where id = $1",
      [luca],
    );
    expect(rows[0]).toEqual({ categoria_verificata_il: null });

    const negato = await errore(
      asRole(db, "authenticated", luca, () =>
        db.query(
          "update utenti set categoria_verificata_il = now() where id = $1",
          [luca],
        ),
      ),
    );
    expect(negato.code).toBe("42501");
    expect(
      (
        await errore(
          asRole(db, "authenticated", luca, () =>
            db.query("select admin_verifica_categoria($1)", [luca]),
          ),
        )
      ).code,
    ).toBe("42501");

    await comeAdmin(() =>
      db.query("select admin_verifica_categoria($1)", [luca]),
    );
    const { rows: dopo } = await db.query<{ v: boolean }>(
      "select categoria_verificata_il is not null as v from utenti where id = $1",
      [luca],
    );
    expect(dopo[0].v).toBe(true);
  });

  it("se il giocatore cambia da sé la categoria torna da verificare", async () => {
    const luca = await giocatore("Rossi");
    await comeAdmin(() =>
      db.query("select admin_verifica_categoria($1)", [luca]),
    );
    await asRole(db, "authenticated", luca, () =>
      db.query("update utenti set categoria = 'F' where id = $1", [luca]),
    );
    const { rows } = await db.query(
      "select categoria, categoria_verificata_il from utenti where id = $1",
      [luca],
    );
    expect(rows[0]).toEqual({ categoria: "F", categoria_verificata_il: null });
  });
});

describe("admin_cambia_categoria", () => {
  it("solo un admin, con verifica del server", async () => {
    const luca = await giocatore("Rossi");
    const e = await errore(
      asRole(db, "authenticated", luca, () => cambia(luca, "F", "[]")),
    );
    expect(e.code).toBe("42501");
    const lettura = await errore(
      asRole(db, "authenticated", luca, () =>
        db.query("select effetti_cambio_categoria($1, 'F')", [luca]),
      ),
    );
    expect(lettura.code).toBe("42501");
  });

  it("sposta le iscrizioni future nel nuovo tabellone, anche oltre il massimo, e scrive il registro", async () => {
    const luca = await giocatore("Rossi");
    const aperta = await tappa("iscrizioni_aperte", "2027-07-04");
    const piena = await tappa("iscrizioni_chiuse", "2027-07-18", 1);
    const passata = await tappa("conclusa", "2026-06-01");
    await iscrivi(passata, luca, "M");
    const sua = await iscrivi(aperta, luca, "M");
    await iscrivi(piena, luca, "M");
    await iscrivi(aperta, await giocatore("Bianchi", "F"), "F");
    await iscrivi(piena, await giocatore("Verdi", "F"), "F");
    // Proposed group on the men's board of the closed stage.
    const { rows: g } = await db.query<{ id: string }>(
      `insert into gironi (tabellone_id, nome, posizione) values ($1, 'Girone A', 1) returning id`,
      [await tabellone(piena, "M")],
    );
    const { rows: pienaM } = await db.query<{ id: string }>(
      "select id from iscrizioni where tappa_id = $1 and utente_id = $2",
      [piena, luca],
    );
    await db.query(
      "insert into girone_iscrizioni (girone_id, iscrizione_id) values ($1, $2)",
      [g[0].id, pienaM[0].id],
    );

    const prima = await effetti(luca, "F");
    expect(prima.da).toBe("M");
    expect(prima.bloccanti).toEqual([]);
    expect(
      prima.iscrizioni.map((i) => ({
        tappa: i.tappa_id,
        posto: i.posto_dopo,
        oltre: i.oltre_massimo,
        girone: i.in_girone,
      })),
    ).toEqual([
      { tappa: aperta, posto: 2, oltre: false, girone: false },
      { tappa: piena, posto: 2, oltre: true, girone: true },
    ]);

    const esito = await comeAdmin(() =>
      cambia(
        luca,
        "F",
        attesi(prima),
        "Categoria sbagliata alla registrazione",
      ),
    );
    expect(esito.tappe_classifica).toEqual([passata]);

    const { rows: iscrizioni } = await db.query<{
      tappa_id: string;
      categoria: string;
      posto: number;
    }>(
      `select i.tappa_id, tb.categoria, i.posto from iscrizioni i
       join tabelloni tb on tb.id = i.tabellone_id
       where i.utente_id = $1 order by i.tappa_id`,
      [luca],
    );
    const per = Object.fromEntries(iscrizioni.map((i) => [i.tappa_id, i]));
    expect(per[aperta]).toMatchObject({ categoria: "F", posto: 2 });
    expect(per[piena]).toMatchObject({ categoria: "F", posto: 2 });
    // A played stage stays on the board it was played on.
    expect(per[passata].categoria).toBe("M");
    expect(per[sua.id]).toBeUndefined();

    const { rows: gironi } = await db.query(
      "select count(*)::int as n from girone_iscrizioni where girone_id = $1",
      [g[0].id],
    );
    expect(gironi[0]).toEqual({ n: 0 });
    const { rows: versione } = await db.query(
      "select versione_gironi from tabelloni where id = $1",
      [await tabellone(piena, "M")],
    );
    expect(versione[0]).toEqual({ versione_gironi: 1 });

    const { rows: utente } = await db.query<{ categoria: string; v: boolean }>(
      "select categoria, categoria_verificata_il is not null as v from utenti where id = $1",
      [luca],
    );
    expect(utente[0]).toEqual({ categoria: "F", v: true });

    const { rows: registro } = await db.query<{
      entita: string;
      valore_prima: Record<string, unknown>;
      valore_dopo: Record<string, unknown>;
      nota: string;
      attore_id: string;
    }>(
      `select entita, valore_prima, valore_dopo, nota, attore_id from registro
       where tipo = 'cambio_categoria' order by entita, valore_dopo ->> 'tappa_id'`,
    );
    expect(registro).toHaveLength(3);
    expect(registro.every((r) => r.attore_id === admin)).toBe(true);
    expect(
      registro.every(
        (r) => r.nota === "Categoria sbagliata alla registrazione",
      ),
    ).toBe(true);
    const sullaTappa = registro.find(
      (r) => r.entita === "iscrizioni" && r.valore_dopo.tappa_id === aperta,
    );
    expect(sullaTappa?.valore_prima).toEqual({
      categoria: "M",
      posto: 1,
      tappa_id: aperta,
    });
    expect(sullaTappa?.valore_dopo).toMatchObject({ categoria: "F", posto: 2 });
    expect(registro.find((r) => r.entita === "utenti")?.valore_dopo).toEqual({
      categoria: "F",
      iscrizioni_spostate: 2,
    });

    // The per-stage event is in that stage's registro (BLVS-35).
    const { rows: voci } = await comeAdmin(() =>
      db.query<{ tipo: string }>(
        "select tipo from registro_tappa($1, null, null, null, 30)",
        [aperta],
      ),
    );
    expect(voci.map((v) => v.tipo)).toEqual(["cambio_categoria"]);
  });

  it("rifiuta se gli effetti confermati non sono più quelli", async () => {
    const luca = await giocatore("Rossi");
    const aperta = await tappa("iscrizioni_aperte");
    await iscrivi(aperta, luca, "M");
    const visti = attesi(await effetti(luca, "F"));
    // Meanwhile someone takes the women's seat 1.
    await iscrivi(aperta, await giocatore("Bianchi", "F"), "F");
    const e = await errore(comeAdmin(() => cambia(luca, "F", visti)));
    expect(e).toMatchObject({ code: "40001", hint: "effetti_cambiati" });
    const { rows } = await db.query(
      "select categoria from utenti where id = $1",
      [luca],
    );
    expect(rows[0]).toEqual({ categoria: "M" });
  });

  it("blocca con un'iscrizione attiva a una tappa in corso, e sulla stessa categoria", async () => {
    const luca = await giocatore("Rossi");
    const inCorso = await tappa("iscrizioni_chiuse", "2027-06-20");
    await iscrivi(inCorso, luca, "M");
    await db.query("update tappe set stato = 'in_corso' where id = $1", [
      inCorso,
    ]);

    const e = await effetti(luca, "F");
    expect(e.bloccanti.map((b) => b.tappa_id)).toEqual([inCorso]);
    const rifiuto = await errore(comeAdmin(() => cambia(luca, "F", "[]")));
    expect(rifiuto).toMatchObject({ code: "23514", hint: "tappa_in_corso" });
    expect(rifiuto.detail).toBe("Tappa 2027-06-20");

    const stessa = await errore(comeAdmin(() => cambia(luca, "M", "[]")));
    expect(stessa).toMatchObject({ hint: "stessa_categoria" });
  });
});

describe("classifica generale dopo il cambio", () => {
  async function partita(
    tappaId: string,
    gironeId: string,
    [a, b, c, d]: string[],
  ) {
    const tb = await tabellone(tappaId, "M");
    const { rows } = await db.query<{ id: string }>(
      `insert into partite (tabellone_id, girone_id, fase, stato)
       values ($1, $2, 'finale', 'conclusa') returning id`,
      [tb, gironeId],
    );
    for (const [i, s] of [
      [a, "A"],
      [b, "A"],
      [c, "B"],
      [d, "B"],
    ]) {
      await db.query(
        "insert into partita_giocatori (partita_id, iscrizione_id, squadra) values ($1, $2, $3)",
        [rows[0].id, i, s],
      );
    }
    await db.query(
      'update punteggi set sets = \'[{"a":21,"b":15}]\'::jsonb, versione = versione + 1 where partita_id = $1',
      [rows[0].id],
    );
  }

  async function classifica(categoria: string) {
    const { rows } = await asRole(db, "anon", null, () =>
      db.query<{ d: DatiClassificaGenerale }>(
        "select classifica_generale_dati($1::categoria, null) as d",
        [categoria],
      ),
    );
    return classificaDaDati(rows[0].d, categoria as "M" | "F", null);
  }

  it("i punti passano dalla classifica M alla F; la tappa resta sul tabellone M", async () => {
    const giocata = await tappa("conclusa", "2026-06-01");
    const nomi = ["Rossi", "Bianchi", "Verdi", "Neri"];
    const utenti: string[] = [];
    const iscrizioni: string[] = [];
    for (const n of nomi) {
      const u = await giocatore(n);
      utenti.push(u);
      iscrizioni.push((await iscrivi(giocata, u, "M")).id);
    }
    const { rows: g } = await db.query<{ id: string }>(
      `insert into gironi (tabellone_id, nome, posizione, fase)
       values ($1, 'Finale gold', 1, 'finale_gold') returning id`,
      [await tabellone(giocata, "M")],
    );
    for (const i of iscrizioni) {
      await db.query(
        "insert into girone_iscrizioni (girone_id, iscrizione_id) values ($1, $2)",
        [g[0].id, i],
      );
    }
    const [a, b, c, d] = iscrizioni;
    await partita(giocata, g[0].id, [a, b, c, d]);
    await partita(giocata, g[0].id, [a, c, b, d]);
    await partita(giocata, g[0].id, [a, d, b, c]);

    const primaM = await classifica("M");
    const rossi = primaM.righe.find((r) => r.utenteId === utenti[0]);
    expect(rossi?.posizione).toBe(1);
    const punti = rossi!.punti;
    expect(punti).toBeGreaterThan(0);

    await comeAdmin(() => cambia(utenti[0], "F", "[]"));

    const dopoM = await classifica("M");
    expect(dopoM.righe.some((r) => r.utenteId === utenti[0])).toBe(false);
    expect(dopoM.righe.map((r) => r.utenteId).sort()).toEqual(
      utenti.slice(1).sort(),
    );
    const dopoF = await classifica("F");
    expect(dopoF.righe.find((r) => r.utenteId === utenti[0])).toMatchObject({
      posizione: 1,
      punti,
    });

    // The stage standing (board M) still lists him in first place.
    const { rows } = await asRole(db, "anon", null, () =>
      db.query<{ d: DatiClassificaGenerale }>(
        "select classifica_generale_dati('M', null) as d",
      ),
    );
    expect(rows[0].d.iscrizioni.map((i) => i.utente_id)).toContain(utenti[0]);
    expect(
      rows[0].d.iscrizioni.find((i) => i.utente_id === utenti[0])
        ?.categoria_attuale,
    ).toBe("F");
  });
});
