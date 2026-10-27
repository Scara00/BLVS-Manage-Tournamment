// @vitest-environment node
import { beforeEach, describe, expect, it } from "vitest";
import {
  asRole,
  createAuthUser,
  createTestDatabase,
  type TestDatabase,
} from "@/test/pglite";

let db: TestDatabase;

type PostiTappa = {
  tappa_id: string;
  categoria: "M" | "F";
  posti: number;
  occupati: number;
  fase: string | null;
};

async function createStage(stato = "iscrizioni_aperte") {
  const { rows } = await db.query<{ id: string }>(
    `insert into tappe (nome, luogo, data_inizio, data_fine, stato)
     values ('Tappa test', 'Spiaggia', '2027-06-01', '2027-06-02', 'iscrizioni_aperte')
     returning id`,
  );
  const id = rows[0].id;
  if (stato !== "iscrizioni_aperte") await setStato(id, stato);
  return id;
}

function setStato(id: string, stato: string) {
  return db.query("update tappe set stato = $2 where id = $1", [id, stato]);
}

async function register(tappaId: string, stato: string, categoria = "M") {
  const utente = await createAuthUser(db, {
    email: `${crypto.randomUUID()}@example.it`,
    categoria: categoria as "M" | "F",
  });
  await db.query(
    `insert into iscrizioni (tappa_id, tabellone_id, utente_id, stato)
     select $1, id, $2, $3 from tabelloni where tappa_id = $1 and categoria = $4`,
    [tappaId, utente, stato, categoria],
  );
  return utente;
}

async function addMatch(tappaId: string, categoria: string, fase: string) {
  await db.query(
    `insert into partite (tabellone_id, fase)
     select id, $3 from tabelloni where tappa_id = $1 and categoria = $2`,
    [tappaId, categoria, fase],
  );
}

function postiTappe(role: "anon" | "authenticated", sub: string | null) {
  return asRole(db, role, sub, async () => {
    const { rows } = await db.query<PostiTappa>(
      "select * from public.posti_tappe() order by tappa_id, categoria",
    );
    return rows;
  });
}

beforeEach(async () => {
  db = await createTestDatabase();
});

describe("posti_tappe(): posti per categoria visibili ai giocatori", () => {
  it("conta solo le iscrizioni in attesa o confermate, per tabellone", async () => {
    const tappa = await createStage();
    await db.query(
      "update tabelloni set posti = 12 where tappa_id = $1 and categoria = 'F'",
      [tappa],
    );
    await register(tappa, "in_attesa");
    await register(tappa, "confermata");
    await register(tappa, "rifiutata");
    await register(tappa, "ritirata");
    await register(tappa, "confermata", "F");
    const giocatore = await createAuthUser(db, { email: "io@example.it" });

    const rows = await postiTappe("authenticated", giocatore);
    expect(
      rows.map(({ categoria, posti, occupati }) => ({
        categoria,
        posti,
        occupati,
      })),
    ).toEqual([
      { categoria: "M", posti: 16, occupati: 2 },
      { categoria: "F", posti: 12, occupati: 1 },
    ]);
  });

  it("restituisce solo i numeri, non chi è iscritto", async () => {
    const tappa = await createStage();
    const altro = await register(tappa, "confermata");
    const rows = await postiTappe("anon", null);
    expect(Object.keys(rows[0]).sort()).toEqual([
      "categoria",
      "fase",
      "occupati",
      "posti",
      "tappa_id",
    ]);
    expect(JSON.stringify(rows)).not.toContain(altro);
  });

  it("nasconde le bozze a ospiti e giocatori", async () => {
    const bozza = await createStage("bozza");
    const aperta = await createStage();
    const giocatore = await createAuthUser(db, { email: "io@example.it" });

    for (const [role, sub] of [
      ["anon", null],
      ["authenticated", giocatore],
    ] as const) {
      const ids = new Set((await postiTappe(role, sub)).map((r) => r.tappa_id));
      expect(ids.has(bozza)).toBe(false);
      expect(ids.has(aperta)).toBe(true);
    }
  });

  it("dà la fase più avanzata delle partite solo se la tappa è in corso", async () => {
    const tappa = await createStage();
    await addMatch(tappa, "M", "gironi");
    await addMatch(tappa, "M", "eliminazione");
    await addMatch(tappa, "F", "gironi");

    expect((await postiTappe("anon", null)).every((r) => r.fase === null)).toBe(
      true,
    );

    await setStato(tappa, "in_corso");
    const fasi = Object.fromEntries(
      (await postiTappe("anon", null)).map((r) => [r.categoria, r.fase]),
    );
    expect(fasi).toEqual({ M: "eliminazione", F: "gironi" });
  });
});
