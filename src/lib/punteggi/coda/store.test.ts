import { IDBFactory } from "fake-indexeddb";
import { describe, expect, it } from "vitest";
import { nuovaVoce } from "./coda";
import { indexedDbStore } from "./store";

const T0 = new Date("2027-06-12T10:00:00Z");

function voce(partitaId: string) {
  return nuovaVoce(
    {
      partitaId,
      versione: 1,
      sets: [{ a: 21, b: 18 }],
      etichetta: "Girone A · turno 1",
      path: "/admin",
    },
    { autoreId: "a1", now: T0 },
  );
}

describe("indexedDbStore", () => {
  it("scrive, rilegge ed elimina le voci", async () => {
    const store = indexedDbStore(new IDBFactory());
    const a = voce("p1");
    const b = voce("p2");
    await store.scrivi(a);
    await store.scrivi(b);
    await store.scrivi({ ...a, stato: "salvato" });
    expect(
      (await store.leggi()).map((v) => [v.partitaId, v.stato]).sort(),
    ).toEqual([
      ["p1", "salvato"],
      ["p2", "in_attesa"],
    ]);
    await store.elimina(a.chiave);
    expect((await store.leggi()).map((v) => v.chiave)).toEqual([b.chiave]);
  });

  it("la coda sopravvive alla pagina: un nuovo store la ritrova", async () => {
    const factory = new IDBFactory();
    const a = voce("p1");
    await indexedDbStore(factory).scrivi(a);
    expect(await indexedDbStore(factory).leggi()).toEqual([a]);
  });
});
