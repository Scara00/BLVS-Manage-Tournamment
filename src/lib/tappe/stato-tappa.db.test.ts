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

const FUTURA = "2099-06-01 23:59+02";
const PASSATA = "2020-06-01 23:59+02";

async function createStage(stato: string, chiudono: string | null = FUTURA) {
  const { rows } = await db.query<{ id: string }>(
    `insert into tappe (nome, luogo, data_inizio, data_fine, stato, iscrizioni_chiudono_il)
     values ('Tappa test', 'Spiaggia', '2099-07-01', '2099-07-02', $1, $2)
     returning id`,
    [stato, chiudono],
  );
  return rows[0].id;
}

async function stage(id: string) {
  const { rows } = await db.query<{
    stato: string;
    chiusura_automatica: boolean;
    iscrizioni_chiuse_il: Date | null;
  }>(
    "select stato, chiusura_automatica, iscrizioni_chiuse_il from tappe where id = $1",
    [id],
  );
  return rows[0];
}

function asAdmin<T>(fn: () => Promise<T>) {
  return asRole(db, "authenticated", admin, fn);
}

function setStato(id: string, stato: string) {
  return db.query("update tappe set stato = $2 where id = $1", [id, stato]);
}

beforeEach(async () => {
  db = await createTestDatabase();
  admin = await createAuthUser(db, { email: "admin@example.it" });
  await db.query("update utenti set ruolo = 'admin' where id = $1", [admin]);
  giocatore = await createAuthUser(db, { email: "marco@example.it" });
  await db.query(
    "update auth.users set email_confirmed_at = now() where id = $1",
    [giocatore],
  );
});

describe("transizioni di stato della tappa", () => {
  it("l'admin apre una bozza e poi chiude le iscrizioni", async () => {
    const id = await createStage("bozza");
    await asAdmin(() => setStato(id, "iscrizioni_aperte"));
    expect((await stage(id)).stato).toBe("iscrizioni_aperte");

    await asAdmin(() => setStato(id, "iscrizioni_chiuse"));
    const chiusa = await stage(id);
    expect(chiusa.stato).toBe("iscrizioni_chiuse");
    expect(chiusa.chiusura_automatica).toBe(false);
    expect(chiusa.iscrizioni_chiuse_il).not.toBeNull();
  });

  it.each([
    ["bozza", "iscrizioni_chiuse"],
    ["iscrizioni_aperte", "bozza"],
    ["iscrizioni_chiuse", "iscrizioni_aperte"],
    ["iscrizioni_chiuse", "bozza"],
  ])("rifiuta %s → %s anche all'admin", async (da, a) => {
    const id = await createStage(da);
    await expect(asAdmin(() => setStato(id, a))).rejects.toMatchObject({
      code: "23514",
      hint: "transizione_non_permessa",
    });
    expect((await stage(id)).stato).toBe(da);
  });

  it.each([null, PASSATA])(
    "non apre le iscrizioni senza una scadenza futura (%s)",
    async (chiudono) => {
      const id = await createStage("bozza", chiudono);
      await expect(
        asAdmin(() => setStato(id, "iscrizioni_aperte")),
      ).rejects.toMatchObject({ code: "23514", hint: "scadenza_mancante" });
    },
  );

  it("il giocatore non cambia lo stato (RLS)", async () => {
    const id = await createStage("bozza");
    const result = await asRole(db, "authenticated", giocatore, () =>
      setStato(id, "iscrizioni_aperte"),
    );
    expect(result.affectedRows).toBe(0);
    expect((await stage(id)).stato).toBe("bozza");
  });

  it("l'admin non può segnare a mano una chiusura come automatica", async () => {
    const id = await createStage("iscrizioni_aperte");
    await asAdmin(() =>
      db.query(
        "update tappe set stato = 'iscrizioni_chiuse', chiusura_automatica = true where id = $1",
        [id],
      ),
    );
    expect((await stage(id)).chiusura_automatica).toBe(false);
  });
});

describe("chiusura automatica alla scadenza", () => {
  it("chiude solo le tappe aperte con la scadenza passata", async () => {
    const scaduta = await createStage("iscrizioni_aperte", PASSATA);
    const aperta = await createStage("iscrizioni_aperte", FUTURA);
    const bozza = await createStage("bozza", PASSATA);

    const { rows } = await db.query<{ chiuse: number }>(
      "select public.chiudi_iscrizioni_scadute() as chiuse",
    );
    expect(rows[0].chiuse).toBe(1);

    const chiusa = await stage(scaduta);
    expect(chiusa.stato).toBe("iscrizioni_chiuse");
    expect(chiusa.chiusura_automatica).toBe(true);
    expect((await stage(aperta)).stato).toBe("iscrizioni_aperte");
    expect((await stage(bozza)).stato).toBe("bozza");
  });

  it("chiamata da una sessione resta automatica e idempotente", async () => {
    const scaduta = await createStage("iscrizioni_aperte", PASSATA);
    await asAdmin(() => db.query("select public.chiudi_iscrizioni_scadute()"));
    await asAdmin(() => db.query("select public.chiudi_iscrizioni_scadute()"));
    expect(await stage(scaduta)).toMatchObject({
      stato: "iscrizioni_chiuse",
      chiusura_automatica: true,
    });
  });

  it("dopo la scadenza nessuno si iscrive, anche prima del job", async () => {
    const id = await createStage("iscrizioni_aperte", PASSATA);
    await expect(
      asRole(db, "authenticated", giocatore, () =>
        db.query(
          `insert into iscrizioni (tappa_id, tabellone_id, utente_id, stato)
           select $1, id, $2, 'in_attesa' from tabelloni
           where tappa_id = $1 and categoria = 'M'`,
          [id, giocatore],
        ),
      ),
    ).rejects.toMatchObject({ code: "42501" });
  });

  it("prima della scadenza il giocatore si iscrive", async () => {
    const id = await createStage("iscrizioni_aperte", FUTURA);
    await asRole(db, "authenticated", giocatore, () =>
      db.query(
        `insert into iscrizioni (tappa_id, tabellone_id, utente_id, stato)
         select $1, id, $2, 'in_attesa' from tabelloni
         where tappa_id = $1 and categoria = 'M'`,
        [id, giocatore],
      ),
    );
    const { rows } = await db.query("select 1 from iscrizioni");
    expect(rows).toHaveLength(1);
  });
});
