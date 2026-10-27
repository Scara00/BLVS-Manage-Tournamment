import { beforeEach, describe, expect, it } from "vitest";
import {
  creaDemoPartitaPunteggio,
  leggiDemoPartitaPunteggio,
  salvaDemoPunteggio,
} from "@/lib/demo/coda-punteggi";
import { nuovaVoce } from "./coda";
import { creaCoda } from "./controller";
import { creaInviatore } from "./invio";
import { memoriaStore, type CodaStore } from "./store";
import type { EsitoInvio, InviaPunteggio, NuovoPunteggio } from "./types";

const T0 = new Date("2027-06-12T10:00:00Z");

/**
 * A server with the rules of `salva_punteggio_coda` (the demo store) and
 * switches for what goes wrong on the way.
 */
function server() {
  const s = {
    rete: true,
    sessione: true,
    /** The save commits but the answer never comes back. */
    rispostaPersa: false,
    chiamate: 0,
    invia: (async (invio) => {
      s.chiamate++;
      if (!s.rete) throw new TypeError("Failed to fetch");
      if (!s.sessione) return { status: "sessionExpired" } as EsitoInvio;
      const esito = salvaDemoPunteggio(invio);
      if (s.rispostaPersa) {
        s.rispostaPersa = false;
        throw new TypeError("Failed to fetch");
      }
      return esito;
    }) as InviaPunteggio,
  };
  return s;
}

let partitaId: string;
let store: CodaStore;

function punteggio(over: Partial<NuovoPunteggio> = {}): NuovoPunteggio {
  return {
    partitaId,
    versione: 1,
    sets: [{ a: 21, b: 18 }],
    etichetta: "Girone A · turno 1",
    path: "/admin",
    ...over,
  };
}

async function accoda(over: Partial<NuovoPunteggio> = {}, autoreId = "a1") {
  const voce = nuovaVoce(punteggio(over), { autoreId, now: T0 });
  await store.scrivi(voce);
  return voce;
}

async function stati() {
  return (await store.leggi()).map((v) => v.stato);
}

beforeEach(() => {
  partitaId = creaDemoPartitaPunteggio().partitaId;
  store = memoriaStore();
});

describe("invio unico", () => {
  it("chiamate contemporanee inviano una volta sola", async () => {
    const srv = server();
    const inviatore = creaInviatore({
      store,
      invia: srv.invia,
      autoreId: () => "a1",
      now: () => T0,
      locks: null,
    });
    await accoda();
    await Promise.all([
      inviatore.svuota(),
      inviatore.svuota(true),
      inviatore.svuota(),
    ]);
    expect(srv.chiamate).toBe(1);
    expect(leggiDemoPartitaPunteggio(partitaId)?.scritture).toBe(1);
    expect(await stati()).toEqual(["salvato"]);
  });

  it("una risposta persa non salva due volte al nuovo tentativo", async () => {
    const srv = server();
    srv.rispostaPersa = true;
    const inviatore = creaInviatore({
      store,
      invia: srv.invia,
      autoreId: () => "a1",
      now: () => T0,
      locks: null,
    });
    await accoda();
    await inviatore.svuota();
    expect(await stati()).toEqual(["in_attesa"]);

    await inviatore.svuota(true);
    expect(await stati()).toEqual(["salvato"]);
    expect(srv.chiamate).toBe(2);
    const partita = leggiDemoPartitaPunteggio(partitaId)!;
    expect(partita).toMatchObject({ scritture: 1, versione: 2 });
  });

  it("senza rete resta in coda, poi riparte da solo", async () => {
    const srv = server();
    srv.rete = false;
    const inviatore = creaInviatore({
      store,
      invia: srv.invia,
      autoreId: () => "a1",
      now: () => T0,
      random: () => 0,
      locks: null,
    });
    await accoda();
    await accoda({ partitaId: creaDemoPartitaPunteggio().partitaId });
    await inviatore.svuota();
    // The second one was not even tried: it waits with the first.
    expect(srv.chiamate).toBe(1);
    expect(await stati()).toEqual(["in_attesa", "in_attesa"]);
    const [a, b] = await store.leggi();
    expect(b.prossimoTentativo).toBe(a.prossimoTentativo);

    srv.rete = true;
    await inviatore.svuota(true);
    expect(await stati()).toEqual(["salvato", "salvato"]);
  });

  it("due schede: il lock ne lascia inviare una", async () => {
    const srv = server();
    let occupato = false;
    const locks = {
      async request<T>(
        _name: string,
        _o: { ifAvailable: boolean },
        cb: (lock: unknown) => Promise<T>,
      ) {
        if (occupato) return cb(null);
        occupato = true;
        try {
          return await cb({});
        } finally {
          occupato = false;
        }
      },
    };
    const opts = {
      store,
      invia: srv.invia,
      autoreId: () => "a1",
      now: () => T0,
      locks,
    };
    await accoda();
    await Promise.all([
      creaInviatore(opts).svuota(true),
      creaInviatore(opts).svuota(true),
    ]);
    expect(srv.chiamate).toBe(1);
  });
});

describe("sessione chiusa e ripresa dopo il login", () => {
  it("il dato resta sul dispositivo e parte dopo il nuovo accesso", async () => {
    const srv = server();
    srv.sessione = false;
    let autore: string | null = "a1";
    const coda = creaCoda({
      store,
      invia: srv.invia,
      leggiAutore: async () => autore,
      now: () => T0,
      online: () => true,
    });

    await coda.accoda(punteggio());
    await coda.accoda(
      punteggio({ partitaId: creaDemoPartitaPunteggio().partitaId }),
    );
    await coda.svuota(false);
    expect(await stati()).toEqual(["sessione_chiusa", "sessione_chiusa"]);
    expect(coda.getSnapshot().annuncio).toMatch(
      /salvato qui, non ancora inviato/,
    );
    // Nothing is retried on its own while the session is closed.
    const chiamate = srv.chiamate;
    await coda.svuota(false);
    expect(srv.chiamate).toBe(chiamate);

    // Signed out, then another account signs in on this device: kept.
    autore = "altro-admin";
    srv.sessione = true;
    await coda.svuota(true);
    expect(await stati()).toEqual(["sessione_chiusa", "sessione_chiusa"]);

    // The same admin signs in again: the admin layout mounts and forces.
    autore = "a1";
    await coda.svuota(true);
    expect(await stati()).toEqual(["salvato", "salvato"]);
    expect(coda.getSnapshot().annuncio).toBe("Girone A · turno 1: salvato.");
    expect(leggiDemoPartitaPunteggio(partitaId)?.scritture).toBe(1);
  });
});

describe("conflitto", () => {
  it("resta in coda finché l'admin sceglie, e «tieni il mio» non scrive alla cieca", async () => {
    const srv = server();
    const coda = creaCoda({
      store,
      invia: srv.invia,
      leggiAutore: async () => "a1",
      now: () => T0,
      online: () => true,
    });
    // Another admin saved first.
    salvaDemoPunteggio({
      chiave: crypto.randomUUID(),
      partitaId,
      versione: 1,
      sets: [{ a: 21, b: 10 }],
      autoreId: null,
    });
    const voce = await coda.accoda(punteggio());
    await coda.svuota(false);
    const [conflitto] = await store.leggi();
    expect(conflitto).toMatchObject({
      stato: "conflitto",
      server: { versione: 2, sets: [{ a: 21, b: 10 }] },
    });

    await coda.tieniIlMio(voce.chiave);
    await coda.svuota(false);
    const [mio] = await store.leggi();
    expect(mio.stato).toBe("salvato");
    expect(leggiDemoPartitaPunteggio(partitaId)).toMatchObject({
      sets: [{ a: 21, b: 18 }],
      versione: 3,
    });
  });
});
