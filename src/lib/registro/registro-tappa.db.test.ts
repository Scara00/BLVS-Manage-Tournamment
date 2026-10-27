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
let tappa: string;
let altraTappa: string;
let partita: string;
let girone: string;

type Voce = {
  id: string;
  tipo: string;
  autore: string | null;
  partita_id: string | null;
  partita: { girone: string; squadra_a: string[]; squadra_b: string[] } | null;
  totale: number | string;
};

const asAdmin = <T>(fn: () => Promise<T>) =>
  asRole(db, "authenticated", admin, fn);

async function createStage() {
  const {
    rows: [{ id }],
  } = await db.query<{ id: string }>(
    `insert into tappe (nome, luogo, data_inizio, data_fine, stato)
     values ('Tappa test', 'Spiaggia', '2099-07-01', '2099-07-02', 'in_corso')
     returning id`,
  );
  return id;
}

function evento(
  tipo: string,
  entita: string,
  entitaId: string,
  dopo: unknown = null,
) {
  return asAdmin(() =>
    db.query(
      "select registra_evento($1::tipo_evento_registro, $2, $3, null, $4::jsonb)",
      [tipo, entita, entitaId, dopo === null ? null : JSON.stringify(dopo)],
    ),
  );
}

function pagina(
  params: {
    tipo?: string | null;
    partita?: string | null;
    primaDi?: string | null;
    limite?: number;
  } = {},
  sub = admin,
) {
  return asRole(db, "authenticated", sub, async () => {
    const { rows } = await db.query<Voce>(
      `select * from registro_tappa($1, $2::tipo_evento_registro, $3::uuid, $4::bigint, $5)`,
      [
        tappa,
        params.tipo ?? null,
        params.partita ?? null,
        params.primaDi ?? null,
        params.limite ?? 30,
      ],
    );
    return rows;
  });
}

beforeEach(async () => {
  db = await createTestDatabase();
  admin = await createAuthUser(db, {
    email: "admin@example.it",
    meta: { nome: "Paola", cognome: "Arbitri" },
  });
  await db.query("update utenti set ruolo = 'admin' where id = $1", [admin]);
  giocatore = await createAuthUser(db, { email: "giocatore@example.it" });
  tappa = await createStage();
  altraTappa = await createStage();

  const {
    rows: [g],
  } = await db.query<{ id: string }>(
    `insert into gironi (tabellone_id, nome)
     select id, 'Girone A' from tabelloni where tappa_id = $1 and categoria = 'M'
     returning id`,
    [tappa],
  );
  girone = g.id;
  const {
    rows: [p],
  } = await db.query<{ id: string }>(
    `insert into partite (tabellone_id, girone_id)
     select tabellone_id, id from gironi where id = $1 returning id`,
    [girone],
  );
  partita = p.id;
  const iscritti: string[] = [];
  for (const [nome, cognome] of [
    ["Anna", "Rossi"],
    ["Bruno", "Verdi"],
  ]) {
    const utente = await createAuthUser(db, {
      email: `${nome}@example.it`,
      meta: { nome, cognome },
    });
    const {
      rows: [i],
    } = await db.query<{ id: string }>(
      `insert into iscrizioni (tappa_id, tabellone_id, utente_id, stato)
       select $1, id, $2, 'confermata' from tabelloni where tappa_id = $1 and categoria = 'M'
       returning id`,
      [tappa, utente],
    );
    iscritti.push(i.id);
  }
  await db.query(
    `insert into partita_giocatori (partita_id, iscrizione_id, squadra)
     values ($1, $2, 'A'), ($1, $3, 'B')`,
    [partita, ...iscritti],
  );
});

describe("registro_tappa", () => {
  it("elenca solo gli eventi della tappa, dal più recente, con autore e partita", async () => {
    await evento("inserimento_punteggio", "punteggi", partita, {
      sets: [{ a: 21, b: 18 }],
    });
    await evento("correzione_punteggio", "punteggi", partita);
    const { rows: tabelloni } = await db.query<{ id: string }>(
      "select id from tabelloni where tappa_id = $1 and categoria = 'F'",
      [tappa],
    );
    await evento("rigenerazione_gironi", "tabelloni", tabelloni[0].id);
    // Altra tappa, entità sconosciuta e riga tecnica: non compaiono.
    const { rows: altri } = await db.query<{ id: string }>(
      "select id from tabelloni where tappa_id = $1",
      [altraTappa],
    );
    await evento("rigenerazione_gironi", "tabelloni", altri[0].id);
    await evento("cambio_categoria", "utenti", giocatore);
    // Partita cancellata: vale la tappa dichiarata nel valore.
    await evento("annullamento_punteggio", "punteggi", crypto.randomUUID(), {
      tappa_id: tappa,
    });

    const voci = await pagina();
    expect(voci.map((v) => v.tipo)).toEqual([
      "annullamento_punteggio",
      "rigenerazione_gironi",
      "correzione_punteggio",
      "inserimento_punteggio",
    ]);
    expect(Number(voci[0].totale)).toBe(4);
    const inserimento = voci[3];
    expect(inserimento.autore).toBe("Paola Arbitri");
    expect(inserimento.partita_id).toBe(partita);
    expect(inserimento.partita).toMatchObject({
      girone: "Girone A",
      squadra_a: ["Anna Rossi"],
      squadra_b: ["Bruno Verdi"],
    });
  });

  it("filtra per tipo e per partita e carica le voci precedenti", async () => {
    for (let i = 0; i < 5; i++) {
      await evento("inserimento_punteggio", "punteggi", partita);
    }
    await evento("ritiro", "tappe", tappa);

    expect((await pagina({ tipo: "ritiro" })).map((v) => v.tipo)).toEqual([
      "ritiro",
    ]);
    expect(await pagina({ partita })).toHaveLength(5);

    const prima = await pagina({ limite: 4 });
    expect(prima).toHaveLength(4);
    expect(Number(prima[0].totale)).toBe(6);
    const seconda = await pagina({ limite: 4, primaDi: prima[3].id });
    expect(seconda).toHaveLength(2);
    expect(Number(seconda[0].totale)).toBe(2);
    const ids = [...prima, ...seconda].map((v) => Number(v.id));
    expect(new Set(ids).size).toBe(6);
    expect(ids).toEqual([...ids].sort((a, b) => b - a));
  });

  it("elenca le partite con voci per il filtro", async () => {
    await evento("inserimento_punteggio", "punteggi", partita);
    await evento("correzione_punteggio", "punteggi", partita);
    const { rows } = await asAdmin(() =>
      db.query<{ partita_id: string }>(
        "select * from partite_registro_tappa($1)",
        [tappa],
      ),
    );
    expect(rows.map((r) => r.partita_id)).toEqual([partita]);
  });

  it("solo l'admin legge il registro", async () => {
    await expect(pagina({}, giocatore)).rejects.toMatchObject({
      code: "42501",
    });
  });
});

describe("parità risolta", () => {
  it("risolvi_parita_girone scrive l'evento parita_risolta", async () => {
    const { rows: iscritti } = await db.query<{ id: string }>(
      "select id from iscrizioni where tappa_id = $1 order by id",
      [tappa],
    );
    for (const { id } of iscritti) {
      await db.query(
        "insert into girone_iscrizioni (girone_id, iscrizione_id) values ($1, $2)",
        [girone, id],
      );
    }
    const [a, b] = iscritti.map((r) => r.id);
    const firma = `${a}:1/0/0/0|${b}:1/0/0/0`;
    await asAdmin(() =>
      db.query("select * from risolvi_parita_girone($1, $2, $3::uuid[], $4)", [
        girone,
        firma,
        [b, a],
        "Sorteggio",
      ]),
    );
    await asAdmin(() =>
      db.query("select * from risolvi_parita_girone($1, $2, $3::uuid[], $4)", [
        girone,
        firma,
        [a, b],
        "Ripetuto",
      ]),
    );

    const voci = await asAdmin(() =>
      db.query<{
        tipo: string;
        valore_prima: { ordine: string[] } | null;
        valore_dopo: { girone: string; ordine: string[] };
        nota: string;
      }>("select * from registro_tappa($1, 'parita_risolta')", [tappa]),
    );
    const nomi = await db.query<{ nome: string }>(
      `select u.nome || ' ' || u.cognome as nome from iscrizioni i
       join utenti u on u.id = i.utente_id where i.id = any($1::uuid[])
       order by array_position($1::uuid[], i.id)`,
      [[a, b]],
    );
    const [na, nb] = nomi.rows.map((r) => r.nome);
    expect(voci.rows).toHaveLength(2);
    expect(voci.rows[0]).toMatchObject({
      valore_prima: { ordine: [nb, na] },
      valore_dopo: { girone: "Girone A", ordine: [na, nb] },
      nota: "Ripetuto",
    });
    expect(voci.rows[1].valore_prima).toBeNull();
  });
});
