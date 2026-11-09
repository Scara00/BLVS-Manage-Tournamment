// @vitest-environment node
import { beforeEach, describe, expect, it } from "vitest";
import {
  asRole,
  createAuthUser,
  createTestDatabase,
  type TestDatabase,
} from "@/test/pglite";

let db: TestDatabase;

type DbError = { code?: string; hint?: string; message: string };
type Riga = { id: string; posto: number; stato: string };

async function createStage({
  stato = "iscrizioni_chiuse",
  posti = 4,
}: { stato?: string; posti?: number } = {}) {
  const { rows } = await db.query<{ id: string }>(
    `insert into tappe (nome, luogo, data_inizio, data_fine, stato, iscrizioni_chiudono_il,
       motivo_annullamento)
     values ('Tappa test', 'Spiaggia', '2099-06-10', '2099-06-11', $1::stato_tappa,
       '2099-06-01 23:59+02', case when $1::text = 'annullata' then 'Maltempo' end)
     returning id`,
    [stato],
  );
  const id = rows[0].id;
  await db.query("update tabelloni set posti = $2 where tappa_id = $1", [
    id,
    posti,
  ]);
  return id;
}

async function createPlayer(categoria: "M" | "F" | null = "M") {
  return createAuthUser(db, {
    email: `${crypto.randomUUID()}@example.it`,
    categoria,
  });
}

async function createAdmin() {
  const id = await createPlayer();
  await db.query("update utenti set ruolo = 'admin' where id = $1", [id]);
  return id;
}

function call<T>(sub: string, sql: string, params: unknown[]) {
  return asRole(db, "authenticated", sub, async () => {
    try {
      const { rows } = await db.query<T>(sql, params);
      return { ok: true as const, row: rows[0] };
    } catch (error) {
      return { ok: false as const, error: error as DbError };
    }
  });
}

function aggiungi(admin: string, tappa: string, utente: string) {
  return call<Riga>(
    admin,
    "select * from public.admin_iscrivi_giocatore($1, $2)",
    [tappa, utente],
  );
}

function rimuovi(admin: string, iscrizione: string) {
  return call<Riga>(
    admin,
    "select * from public.admin_rimuovi_iscrizione($1)",
    [iscrizione],
  );
}

async function attivi(tappa: string) {
  const { rows } = await db.query<{ n: number }>(
    `select count(*)::int as n from iscrizioni
     where tappa_id = $1 and stato in ('in_attesa', 'confermata')`,
    [tappa],
  );
  return rows[0].n;
}

beforeEach(async () => {
  db = await createTestDatabase();
});

describe("admin_iscrivi_giocatore()", () => {
  it("iscrive anche a iscrizioni chiuse, con il primo posto libero, già confermato", async () => {
    const admin = await createAdmin();
    const tappa = await createStage({ stato: "iscrizioni_chiuse" });
    const result = await aggiungi(admin, tappa, await createPlayer());
    expect(result).toMatchObject({
      ok: true,
      row: { posto: 1, stato: "confermata" },
    });
  });

  it("rifiuta l'aggiunta oltre il massimo e non cambia gli iscritti", async () => {
    const admin = await createAdmin();
    const tappa = await createStage({ posti: 2 });
    await aggiungi(admin, tappa, await createPlayer());
    await aggiungi(admin, tappa, await createPlayer());
    const result = await aggiungi(admin, tappa, await createPlayer());
    expect(result).toMatchObject({
      ok: false,
      error: { code: "23514", hint: "posti_esauriti" },
    });
    expect(await attivi(tappa)).toBe(2);
  });

  it("il massimo è per tabellone: il femminile ha ancora posto", async () => {
    const admin = await createAdmin();
    const tappa = await createStage({ posti: 1 });
    await aggiungi(admin, tappa, await createPlayer("M"));
    const result = await aggiungi(admin, tappa, await createPlayer("F"));
    expect(result).toMatchObject({ ok: true, row: { posto: 1 } });
  });

  it("rifiuta un giocatore già iscritto", async () => {
    const admin = await createAdmin();
    const tappa = await createStage();
    const giocatore = await createPlayer();
    await aggiungi(admin, tappa, giocatore);
    const result = await aggiungi(admin, tappa, giocatore);
    expect(result).toMatchObject({
      ok: false,
      error: { code: "23505", hint: "gia_iscritto" },
    });
    expect(await attivi(tappa)).toBe(1);
  });

  it("rifiuta chi non ha categoria e chi non esiste", async () => {
    const admin = await createAdmin();
    const tappa = await createStage();
    expect(
      await aggiungi(admin, tappa, await createPlayer(null)),
    ).toMatchObject({ ok: false, error: { hint: "categoria_mancante" } });
    expect(await aggiungi(admin, tappa, crypto.randomUUID())).toMatchObject({
      ok: false,
      error: { code: "P0002", hint: "giocatore_non_trovato" },
    });
  });

  it("iscrive anche un admin, compreso sé stesso", async () => {
    const admin = await createAdmin();
    const tappa = await createStage();
    expect(await aggiungi(admin, tappa, await createAdmin())).toMatchObject({
      ok: true,
      row: { posto: 1, stato: "confermata" },
    });
    expect(await aggiungi(admin, tappa, admin)).toMatchObject({
      ok: true,
      row: { posto: 2, stato: "confermata" },
    });
  });

  it.each([
    ["in_corso", "tappa_non_iscrivibile"],
    ["conclusa", "tappa_non_iscrivibile"],
    ["annullata", "tappa_annullata"],
  ])("rifiuta una tappa %s", async (stato, hint) => {
    const admin = await createAdmin();
    const tappa = await createStage({ stato });
    expect(await aggiungi(admin, tappa, await createPlayer())).toMatchObject({
      ok: false,
      error: { hint },
    });
  });

  it("solo l'admin può chiamarla", async () => {
    const tappa = await createStage();
    const giocatore = await createPlayer();
    expect(await aggiungi(giocatore, tappa, giocatore)).toMatchObject({
      ok: false,
      error: { code: "42501" },
    });
  });
});

describe("admin_rimuovi_iscrizione()", () => {
  it("ritira l'iscrizione e il posto torna libero", async () => {
    const admin = await createAdmin();
    const tappa = await createStage({ posti: 2 });
    const primo = await aggiungi(admin, tappa, await createPlayer());
    await aggiungi(admin, tappa, await createPlayer());
    if (!primo.ok) throw new Error("setup");

    const rimosso = await rimuovi(admin, primo.row.id);
    expect(rimosso).toMatchObject({ ok: true, row: { stato: "ritirata" } });
    expect(await attivi(tappa)).toBe(1);

    // The freed seat 1 goes to the next player, even with the board at 2.
    const nuovo = await aggiungi(admin, tappa, await createPlayer());
    expect(nuovo).toMatchObject({ ok: true, row: { posto: 1 } });
  });

  it("lo stesso giocatore si può iscrivere di nuovo dopo la rimozione", async () => {
    const admin = await createAdmin();
    const tappa = await createStage();
    const giocatore = await createPlayer();
    const prima = await aggiungi(admin, tappa, giocatore);
    if (!prima.ok) throw new Error("setup");
    await rimuovi(admin, prima.row.id);

    const di_nuovo = await aggiungi(admin, tappa, giocatore);
    expect(di_nuovo).toMatchObject({ ok: true, row: { posto: 1 } });
    const { rows } = await db.query(
      "select 1 from iscrizioni where utente_id = $1",
      [giocatore],
    );
    expect(rows).toHaveLength(1);
  });

  it("una rimozione ripetuta non trova l'iscrizione", async () => {
    const admin = await createAdmin();
    const tappa = await createStage();
    const iscritto = await aggiungi(admin, tappa, await createPlayer());
    if (!iscritto.ok) throw new Error("setup");
    await rimuovi(admin, iscritto.row.id);
    expect(await rimuovi(admin, iscritto.row.id)).toMatchObject({
      ok: false,
      error: { code: "P0002" },
    });
  });

  it("rifiuta la rimozione da una tappa in corso", async () => {
    const admin = await createAdmin();
    const tappa = await createStage();
    const iscritto = await aggiungi(admin, tappa, await createPlayer());
    if (!iscritto.ok) throw new Error("setup");
    await db.query("update tappe set stato = 'in_corso' where id = $1", [
      tappa,
    ]);
    expect(await rimuovi(admin, iscritto.row.id)).toMatchObject({
      ok: false,
      error: { hint: "tappa_non_iscrivibile" },
    });
  });

  it("solo l'admin può chiamarla", async () => {
    const admin = await createAdmin();
    const tappa = await createStage();
    const iscritto = await aggiungi(admin, tappa, await createPlayer());
    if (!iscritto.ok) throw new Error("setup");
    expect(await rimuovi(await createPlayer(), iscritto.row.id)).toMatchObject({
      ok: false,
      error: { code: "42501" },
    });
  });
});

/** A self-made registration (pending), written by the backend. */
async function inAttesa(tappa: string, utente: string) {
  const { rows } = await db.query<{ id: string }>(
    `insert into iscrizioni (tappa_id, tabellone_id, utente_id)
     select $1, tb.id, $2 from tabelloni tb
     join utenti u on u.id = $2 and u.categoria = tb.categoria
     where tb.tappa_id = $1
     returning id`,
    [tappa, utente],
  );
  return rows[0].id;
}

function conferma(admin: string, tappa: string, iscrizioni: string[] | null) {
  return call<{ admin_conferma_iscrizioni: number }>(
    admin,
    "select admin_conferma_iscrizioni($1, $2::uuid[])",
    [tappa, iscrizioni],
  );
}

async function statoDi(iscrizione: string) {
  const { rows } = await db.query<{ stato: string }>(
    "select stato from iscrizioni where id = $1",
    [iscrizione],
  );
  return rows[0]?.stato;
}

describe("admin_conferma_iscrizioni()", () => {
  it("conferma solo l'iscrizione indicata", async () => {
    const admin = await createAdmin();
    const tappa = await createStage();
    const a = await inAttesa(tappa, await createPlayer());
    const b = await inAttesa(tappa, await createPlayer("F"));

    expect(await conferma(admin, tappa, [a])).toMatchObject({
      ok: true,
      row: { admin_conferma_iscrizioni: 1 },
    });
    expect(await statoDi(a)).toBe("confermata");
    expect(await statoDi(b)).toBe("in_attesa");
  });

  it("senza elenco conferma tutte quelle in attesa della tappa, non di altre", async () => {
    const admin = await createAdmin();
    const tappa = await createStage();
    const altra = await createStage();
    const mie = [
      await inAttesa(tappa, await createPlayer()),
      await inAttesa(tappa, await createPlayer()),
      await inAttesa(tappa, await createPlayer("F")),
    ];
    const fuori = await inAttesa(altra, await createPlayer());

    expect(await conferma(admin, tappa, null)).toMatchObject({
      ok: true,
      row: { admin_conferma_iscrizioni: 3 },
    });
    for (const id of mie) expect(await statoDi(id)).toBe("confermata");
    expect(await statoDi(fuori)).toBe("in_attesa");
    // Nothing left: a second «Conferma tutte» confirms none.
    expect(await conferma(admin, tappa, null)).toMatchObject({
      row: { admin_conferma_iscrizioni: 0 },
    });
  });

  it("un'iscrizione già confermata non è un errore, una ritirata o di un'altra tappa sì", async () => {
    const admin = await createAdmin();
    const tappa = await createStage();
    const aggiunta = await aggiungi(admin, tappa, await createPlayer());
    if (!aggiunta.ok) throw new Error("setup");
    expect(await conferma(admin, tappa, [aggiunta.row.id])).toMatchObject({
      ok: true,
      row: { admin_conferma_iscrizioni: 0 },
    });

    const ritirata = await inAttesa(tappa, await createPlayer());
    await db.query("update iscrizioni set stato = 'ritirata' where id = $1", [
      ritirata,
    ]);
    const altrove = await inAttesa(await createStage(), await createPlayer());
    for (const id of [ritirata, altrove, crypto.randomUUID()]) {
      expect(await conferma(admin, tappa, [id])).toMatchObject({
        ok: false,
        error: { code: "P0002", hint: "iscrizione_non_trovata" },
      });
    }
    expect(await statoDi(altrove)).toBe("in_attesa");
  });

  it.each([
    ["in_corso", "tappa_non_iscrivibile"],
    ["conclusa", "tappa_non_iscrivibile"],
    ["annullata", "tappa_annullata"],
  ])("rifiuta una tappa %s", async (stato, hint) => {
    const admin = await createAdmin();
    const tappa = await createStage({ stato });
    expect(await conferma(admin, tappa, null)).toMatchObject({
      ok: false,
      error: { hint },
    });
  });

  it("solo l'admin può chiamarla", async () => {
    const tappa = await createStage();
    const giocatore = await createPlayer();
    const sua = await inAttesa(tappa, giocatore);
    expect(await conferma(giocatore, tappa, [sua])).toMatchObject({
      ok: false,
      error: { code: "42501" },
    });
    expect(await statoDi(sua)).toBe("in_attesa");
  });
});

describe("admin_iscrivi_giocatore_manuale()", () => {
  function aggiungiManuale(
    admin: string,
    tappa: string,
    nome: string | null = "Mario",
    cognome: string | null = "Verdi",
    categoria: string | null = "M",
  ) {
    return call<Riga & { utente_id: string; tabellone_id: string }>(
      admin,
      "select * from public.admin_iscrivi_giocatore_manuale($1, $2, $3, $4)",
      [tappa, nome, cognome, categoria],
    );
  }

  async function accountManuali() {
    const { rows } = await db.query<{ n: number }>(
      `select count(*)::int as n from auth.users
       where email like '%@manuale.blvs.invalid'`,
    );
    return rows[0].n;
  }

  it("crea il giocatore e lo iscrive confermato al primo posto libero", async () => {
    const admin = await createAdmin();
    const tappa = await createStage();
    await aggiungi(admin, tappa, await createPlayer("F"));
    const result = await aggiungiManuale(admin, tappa, " Mario ", " Verdi ");
    expect(result).toMatchObject({
      ok: true,
      row: { posto: 1, stato: "confermata" },
    });
    if (!result.ok) return;

    const { rows } = await db.query(
      `select u.nome, u.cognome, u.categoria, u.ruolo, t.categoria as tabellone
       from utenti u, tabelloni t
       where u.id = $1 and t.id = $2`,
      [result.row.utente_id, result.row.tabellone_id],
    );
    expect(rows[0]).toEqual({
      nome: "Mario",
      cognome: "Verdi",
      categoria: "M",
      ruolo: "giocatore",
      tabellone: "M",
    });
  });

  it("l'account non può accedere e non ha consensi", async () => {
    const admin = await createAdmin();
    const result = await aggiungiManuale(admin, await createStage());
    if (!result.ok) throw new Error(result.error.message);
    const id = result.row.utente_id;

    const { rows } = await db.query<{
      email: string;
      encrypted_password: string;
    }>("select email, encrypted_password from auth.users where id = $1", [id]);
    expect(rows[0]).toEqual({
      email: `${id}@manuale.blvs.invalid`,
      encrypted_password: "",
    });
    const identita = await db.query(
      "select 1 from auth.identities where user_id = $1",
      [id],
    );
    expect(identita.rows).toHaveLength(0);
    const consensi = await db.query(
      "select 1 from consensi where utente_id = $1",
      [id],
    );
    expect(consensi.rows).toHaveLength(0);
  });

  it("stesso nome e categoria sono la stessa persona, anche in un'altra tappa", async () => {
    const admin = await createAdmin();
    const prima = await aggiungiManuale(admin, await createStage());
    const seconda = await aggiungiManuale(
      admin,
      await createStage(),
      "  MARIO ",
      "verdi",
    );
    expect(seconda).toMatchObject({ ok: true, row: { posto: 1 } });
    if (!prima.ok || !seconda.ok) throw new Error("iscrizione rifiutata");
    expect(seconda.row.utente_id).toBe(prima.row.utente_id);
    expect(await accountManuali()).toBe(1);
  });

  it("due volte nella stessa tappa è un doppione, non un secondo giocatore", async () => {
    const admin = await createAdmin();
    const tappa = await createStage();
    await aggiungiManuale(admin, tappa);
    expect(await aggiungiManuale(admin, tappa)).toMatchObject({
      ok: false,
      error: { code: "23505", hint: "gia_iscritto" },
    });
    expect(await attivi(tappa)).toBe(1);
    expect(await accountManuali()).toBe(1);
  });

  it("chi era stato rimosso rientra con lo stesso account", async () => {
    const admin = await createAdmin();
    const tappa = await createStage();
    const prima = await aggiungiManuale(admin, tappa);
    if (!prima.ok) throw new Error(prima.error.message);
    await rimuovi(admin, prima.row.id);
    const seconda = await aggiungiManuale(admin, tappa);
    expect(seconda).toMatchObject({
      ok: true,
      row: { utente_id: prima.row.utente_id, stato: "confermata" },
    });
    expect(await accountManuali()).toBe(1);
  });

  it("l'altra categoria è un'altra persona", async () => {
    const admin = await createAdmin();
    const tappa = await createStage();
    await aggiungiManuale(admin, tappa, "Andrea", "Verdi", "M");
    const donna = await aggiungiManuale(admin, tappa, "Andrea", "Verdi", "F");
    expect(donna).toMatchObject({ ok: true, row: { posto: 1 } });
    expect(await accountManuali()).toBe(2);
  });

  it("non si aggancia a un account vero con lo stesso nome", async () => {
    const admin = await createAdmin();
    const vero = await createAuthUser(db, {
      email: "mario.verdi@example.it",
      categoria: "M",
      meta: { nome: "Mario", cognome: "Verdi" },
    });
    const result = await aggiungiManuale(admin, await createStage());
    if (!result.ok) throw new Error(result.error.message);
    expect(result.row.utente_id).not.toBe(vero);
    expect(await accountManuali()).toBe(1);
  });

  it("l'admin lo vede in utenti, come la ricerca di Aggiungi giocatore", async () => {
    const admin = await createAdmin();
    await aggiungiManuale(admin, await createStage());
    const trovati = await call<{ nome: string }>(
      admin,
      `select nome from public.utenti
       where nome ilike $1 or cognome ilike $1 or email ilike $1`,
      ["%verdi%"],
    );
    expect(trovati).toMatchObject({ ok: true, row: { nome: "Mario" } });
  });

  it("su una tappa mista rispetta la metà dei posti della categoria", async () => {
    const admin = await createAdmin();
    const tappa = await asRole(db, "authenticated", admin, async () => {
      const { rows } = await db.query<{ id: string }>(
        "select crea_tappa_mista('K&Q', 'Jesolo', '2099-07-01', '2099-06-30 20:00+02', 8) as id",
      );
      return rows[0].id;
    });
    for (const nome of ["Mario", "Luigi", "Paolo", "Piero"]) {
      expect(await aggiungiManuale(admin, tappa, nome)).toMatchObject({
        ok: true,
      });
    }
    expect(await aggiungiManuale(admin, tappa, "Ugo")).toMatchObject({
      ok: false,
      error: { hint: "posti_esauriti" },
    });
    expect(
      await aggiungiManuale(admin, tappa, "Anna", "Neri", "F"),
    ).toMatchObject({ ok: true });
  });

  it("se l'iscrizione è rifiutata non resta nessun account", async () => {
    const admin = await createAdmin();
    const piena = await createStage({ posti: 1 });
    await aggiungi(admin, piena, await createPlayer());
    expect(await aggiungiManuale(admin, piena)).toMatchObject({
      ok: false,
      error: { code: "23514", hint: "posti_esauriti" },
    });

    const inCorso = await createStage({ stato: "in_corso" });
    expect(await aggiungiManuale(admin, inCorso)).toMatchObject({
      ok: false,
      error: { hint: "tappa_non_iscrivibile" },
    });
    expect(await accountManuali()).toBe(0);
  });

  it.each([
    ["nome vuoto", "   ", "Verdi", "M"],
    ["cognome mancante", "Mario", null, "M"],
    ["categoria mancante", "Mario", "Verdi", null],
    ["nome troppo lungo", "x".repeat(101), "Verdi", "M"],
  ])(
    "rifiuta i dati non validi: %s",
    async (_caso, nome, cognome, categoria) => {
      const admin = await createAdmin();
      const tappa = await createStage();
      expect(
        await aggiungiManuale(admin, tappa, nome, cognome, categoria),
      ).toMatchObject({
        ok: false,
        error: { code: "23514", hint: "dati_giocatore_non_validi" },
      });
      expect(await accountManuali()).toBe(0);
    },
  );

  it("solo l'admin può chiamarla, e l'anonimo non la vede", async () => {
    const tappa = await createStage();
    const giocatore = await createPlayer();
    expect(await aggiungiManuale(giocatore, tappa)).toMatchObject({
      ok: false,
      error: { code: "42501" },
    });
    await expect(
      asRole(db, "anon", null, () =>
        db.query(
          "select public.admin_iscrivi_giocatore_manuale($1, 'Mario', 'Verdi', 'M')",
          [tappa],
        ),
      ),
    ).rejects.toMatchObject({ code: "42501" });
    expect(await accountManuali()).toBe(0);
    expect(await attivi(tappa)).toBe(0);
  });

  it("eliminando l'utente Auth se ne va anche il giocatore", async () => {
    const admin = await createAdmin();
    const tappa = await createStage();
    const result = await aggiungiManuale(admin, tappa);
    if (!result.ok) throw new Error(result.error.message);
    await db.query("delete from auth.users where id = $1", [
      result.row.utente_id,
    ]);
    expect(await attivi(tappa)).toBe(0);
    const { rows } = await db.query("select 1 from utenti where id = $1", [
      result.row.utente_id,
    ]);
    expect(rows).toHaveLength(0);
  });
});
