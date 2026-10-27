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

async function createStage(stato = "iscrizioni_chiuse") {
  const { rows } = await db.query<{ id: string }>(
    `insert into tappe (nome, luogo, data_inizio, data_fine, stato)
     values ('Tappa test', 'Spiaggia', '2099-07-01', '2099-07-02', $1::stato_tappa)
     returning id`,
    [stato],
  );
  return rows[0].id;
}

async function tabellone(tappaId: string, categoria: "M" | "F" = "M") {
  const { rows } = await db.query<{ id: string }>(
    "select id from tabelloni where tappa_id = $1 and categoria = $2::categoria",
    [tappaId, categoria],
  );
  return rows[0].id;
}

async function register(tappaId: string, categoria: "M" | "F") {
  const utente = await createAuthUser(db, {
    email: `${crypto.randomUUID()}@example.it`,
    categoria,
  });
  await db.query(
    `insert into iscrizioni (tappa_id, tabellone_id, utente_id, stato)
     select $1, id, $2, 'confermata' from tabelloni
     where tappa_id = $1 and categoria = $3::categoria`,
    [tappaId, utente, categoria],
  );
}

/** A stage with 8 M and 4 F confirmed players and generated groups. */
async function tappaConGironi() {
  const tappa = await createStage();
  for (let i = 0; i < 8; i++) await register(tappa, "M");
  for (let i = 0; i < 4; i++) await register(tappa, "F");
  await asRole(db, "authenticated", admin, () =>
    db.query("select * from genera_gironi($1)", [tappa]),
  );
  return tappa;
}

/** Writes a score on the first `n` group matches of a board. */
async function segnaPunteggi(tabelloneId: string, n: number) {
  await db.query(
    `update punteggi set sets = '[{"a":21,"b":18},{"a":19,"b":21}]'::jsonb,
            versione = versione + 1
     where partita_id in (
       select p.id from partite p join gironi g on g.id = p.girone_id
       where p.tabellone_id = $1
       order by g.posizione, p.turno limit $2
     )`,
    [tabelloneId, n],
  );
}

type Esito = {
  categoria: string;
  gironi: number;
  partite: number;
  punteggi_persi: number;
  registro_id: string | number;
};

function rigenera(
  tabelloneId: string,
  { conferma = false, attesi = 0, sub = admin } = {},
) {
  return asRole(db, "authenticated", sub, () =>
    db.query<Esito>("select * from rigenera_gironi($1, $2, $3)", [
      tabelloneId,
      conferma,
      attesi,
    ]),
  );
}

function punteggiPersi(tabelloneId: string, sub = admin) {
  return asRole(db, "authenticated", sub, () =>
    db.query<{
      girone: string;
      turno: number;
      sets: unknown;
      squadra_a: string[];
      squadra_b: string[];
    }>("select * from punteggi_rigenerazione($1)", [tabelloneId]),
  );
}

async function errore(promise: Promise<unknown>) {
  try {
    await promise;
  } catch (error) {
    return error as { code?: string; hint?: string; detail?: string };
  }
  throw new Error("La chiamata doveva fallire");
}

async function gironiDi(tabelloneId: string) {
  const { rows } = await db.query<{ id: string }>(
    "select id from gironi where tabellone_id = $1 order by posizione",
    [tabelloneId],
  );
  return rows.map((r) => r.id);
}

async function vociRegistro(tabelloneId: string) {
  const { rows } = await db.query<{
    attore_id: string;
    valore_prima: { punteggi_persi: number; punteggi: unknown[] };
    valore_dopo: { punteggi_persi: number; gironi: number; categoria: string };
    nota: string;
  }>(
    `select attore_id, valore_prima, valore_dopo, nota from registro
     where tipo = 'rigenerazione_gironi' and entita = 'tabelloni'
       and entita_id = $1 order by id`,
    [tabelloneId],
  );
  return rows;
}

beforeEach(async () => {
  db = await createTestDatabase();
  admin = await createAuthUser(db, { email: "admin@example.it" });
  await db.query("update utenti set ruolo = 'admin' where id = $1", [admin]);
});

describe("rigenera_gironi", () => {
  it("senza punteggi rigenera subito solo il tabellone scelto", async () => {
    const tappa = await tappaConGironi();
    const m = await tabellone(tappa, "M");
    const f = await tabellone(tappa, "F");
    const primaM = await gironiDi(m);
    const primaF = await gironiDi(f);

    const { rows } = await rigenera(m);
    expect(rows).toEqual([
      expect.objectContaining({
        categoria: "M",
        gironi: 2,
        partite: 6,
        punteggi_persi: 0,
      }),
    ]);
    const dopoM = await gironiDi(m);
    expect(dopoM).toHaveLength(2);
    expect(dopoM.some((id) => primaM.includes(id))).toBe(false);
    expect(await gironiDi(f)).toEqual(primaF);

    const [voce] = await vociRegistro(m);
    expect(voce.attore_id).toBe(admin);
    expect(voce.valore_dopo).toMatchObject({
      categoria: "M",
      gironi: 2,
      punteggi_persi: 0,
    });
    expect(voce.nota).toBe("Rigenerazione senza punteggi persi");
  });

  it("elenca i punteggi persi: solo partite dei gironi con set", async () => {
    const tappa = await tappaConGironi();
    const m = await tabellone(tappa, "M");
    await segnaPunteggi(m, 2);

    const { rows } = await punteggiPersi(m);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      girone: "Girone A",
      turno: 1,
      sets: [
        { a: 21, b: 18 },
        { a: 19, b: 21 },
      ],
    });
    expect(rows[0].squadra_a).toHaveLength(2);
    expect(rows[0].squadra_b).toHaveLength(2);
    expect((await punteggiPersi(await tabellone(tappa, "F"))).rows).toEqual([]);
  });

  it("con punteggi serve la conferma, poi li perde e lo scrive nel registro", async () => {
    const tappa = await tappaConGironi();
    const m = await tabellone(tappa, "M");
    await segnaPunteggi(m, 3);
    const prima = await gironiDi(m);

    const senza = await errore(rigenera(m));
    expect(senza).toMatchObject({
      code: "23514",
      hint: "conferma_richiesta",
      detail: "3",
    });
    expect(await gironiDi(m)).toEqual(prima);
    expect(await vociRegistro(m)).toEqual([]);

    const { rows } = await rigenera(m, { conferma: true, attesi: 3 });
    expect(rows[0].punteggi_persi).toBe(3);
    expect((await punteggiPersi(m)).rows).toEqual([]);

    const [voce] = await vociRegistro(m);
    expect(voce.valore_prima.punteggi_persi).toBe(3);
    expect(voce.valore_prima.punteggi).toHaveLength(3);
    expect(voce.valore_dopo.punteggi_persi).toBe(3);
    expect(voce.nota).toBe("Rigenerazione con 3 punteggi persi");
  });

  it("si ferma se i punteggi sono cambiati dopo la conferma", async () => {
    const tappa = await tappaConGironi();
    const m = await tabellone(tappa, "M");
    await segnaPunteggi(m, 1);

    // L'admin ha visto 1 punteggio, intanto ne è arrivato un altro.
    await segnaPunteggi(m, 2);
    const err = await errore(rigenera(m, { conferma: true, attesi: 1 }));
    expect(err).toMatchObject({
      code: "40001",
      hint: "punteggi_cambiati",
      detail: "2",
    });
    expect(await vociRegistro(m)).toEqual([]);
  });

  it("funziona a tappa in corso e la rifiuta negli altri stati", async () => {
    const tappa = await tappaConGironi();
    const m = await tabellone(tappa, "M");
    await db.query("update tappe set stato = 'in_corso' where id = $1", [
      tappa,
    ]);
    expect((await rigenera(m)).rows[0].gironi).toBe(2);

    const aperta = await createStage("iscrizioni_aperte");
    expect(await errore(rigenera(await tabellone(aperta, "M")))).toMatchObject({
      code: "23514",
      hint: "tappa_non_rigenerabile",
    });
  });

  it("rifiuta un tabellone concluso o già alla fase a eliminazione", async () => {
    const tappa = await tappaConGironi();
    const m = await tabellone(tappa, "M");
    const f = await tabellone(tappa, "F");
    await db.query(
      "insert into partite (tabellone_id, fase) values ($1, 'eliminazione')",
      [m],
    );
    expect(await errore(rigenera(m))).toMatchObject({
      hint: "fase_successiva",
    });

    await db.query("update tabelloni set concluso_il = now() where id = $1", [
      f,
    ]);
    expect(await errore(rigenera(f))).toMatchObject({
      hint: "tabellone_concluso",
    });
  });

  it("solo un admin rigenera o legge i punteggi persi", async () => {
    const tappa = await tappaConGironi();
    const m = await tabellone(tappa, "M");
    const giocatore = await createAuthUser(db, {
      email: "giocatore@example.it",
      categoria: "M",
    });
    expect(await errore(rigenera(m, { sub: giocatore }))).toMatchObject({
      code: "42501",
    });
    expect(await errore(punteggiPersi(m, giocatore))).toMatchObject({
      code: "42501",
    });
  });

  it("tabellone inesistente: P0002", async () => {
    expect(await errore(rigenera(crypto.randomUUID()))).toMatchObject({
      code: "P0002",
    });
  });
});
