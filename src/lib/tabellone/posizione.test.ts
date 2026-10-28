import { describe, expect, it } from "vitest";
import type { PartitaGirone } from "@/lib/gironi/classifica/classifica";
import { classificaGirone } from "@/lib/gironi/classifica/classifica";
import { vistaTabellone, type DatiTabellone, type GironeDati } from "./dati";
import {
  gironiPerLivello,
  miaPosizione,
  posizioneBreve,
  testoTaglio,
} from "./posizione";
import { taglioGirone, ultimaSopra } from "./taglio";

const AT = "2026-07-18T10:00:00Z";

function partita(
  id: string,
  [a, b, c, d]: string[],
  sets: { a: number; b: number }[],
  stato: PartitaGirone["stato"] = "conclusa",
): PartitaGirone {
  return { id, stato, squadre: { A: [a, b], B: [c, d] }, sets };
}

/** A group of 4 King/Queen: p1 wins all, p4 loses all. */
function girone(
  id: string,
  fase: GironeDati["fase"],
  ids: string[],
  giocate = 3,
): GironeDati {
  const [p1, p2, p3, p4] = ids;
  const partite = [
    partita(`${id}-1`, [p1, p2, p3, p4], [{ a: 21, b: 10 }]),
    partita(`${id}-2`, [p1, p3, p2, p4], [{ a: 21, b: 15 }]),
    partita(`${id}-3`, [p1, p4, p2, p3], [{ a: 21, b: 19 }]),
  ].map((p, i) =>
    i < giocate ? p : { ...p, stato: "programmata" as const, sets: [] },
  );
  return {
    id,
    nome: id,
    fase,
    categoria: "M",
    giocatori: ids,
    classifica: classificaGirone(ids, partite),
  };
}

function dati(
  gironi: GironeDati[],
  faseGioco: DatiTabellone["tabelloni"][number]["faseGioco"] = "gironi_iniziali",
  conclusoIl: string | null = null,
): DatiTabellone {
  const ids = gironi.flatMap((g) => g.giocatori);
  return {
    tappa: { id: "t", nome: "Tappa 1", stato: "in_corso" },
    tabelloni: [
      { categoria: "M", faseGioco, conclusoIl },
      { categoria: "F", faseGioco: null, conclusoIl: null },
    ],
    gironi,
    nomi: new Map(ids.map((id) => [id, `Nome ${id}`])),
    note: new Map(),
  };
}

const A = ["a1", "a2", "a3", "a4"];
const B = ["b1", "b2", "b3", "b4"];

describe("taglioGirone", () => {
  it("girone iniziale: dopo il 2° posto, sopra gold e sotto silver", () => {
    expect(taglioGirone("iniziale", 4)).toEqual({
      dopo: 2,
      sopra: "gironi gold",
      sotto: "gironi silver",
    });
  });

  it("gironi gold: i primi 4/n vanno in finale", () => {
    expect(taglioGirone("gold", 2)?.dopo).toBe(2);
    expect(taglioGirone("gold", 1)?.dopo).toBe(4);
    expect(taglioGirone("silver", 4)?.sopra).toBe("finale silver");
    expect(taglioGirone("gold", 3)).toBeNull();
  });

  it("finali: nessuna linea", () => {
    expect(taglioGirone("finale_gold", 1)).toBeNull();
  });

  it("la linea cade dopo l'ultimo posto sopra", () => {
    const taglio = taglioGirone("iniziale", 1);
    const rows = [1, 2, 3, 4].map((position) => ({ position }));
    expect(rows.map((_, i) => ultimaSopra(rows, i, taglio))).toEqual([
      false,
      true,
      false,
      false,
    ]);
  });
});

describe("miaPosizione", () => {
  it("spettatore: null", () => {
    const stage = vistaTabellone(dati([girone("A", "iniziale", A)]), {
      updatedAt: AT,
    });
    expect(miaPosizione(stage, null)).toBeNull();
  });

  it("iscritto ma non in un girone", () => {
    const stage = vistaTabellone(dati([girone("A", "iniziale", A)]), {
      updatedAt: AT,
    });
    expect(miaPosizione(stage, "x")).toEqual({ stato: "senza_girone" });
  });

  it("girone iniziale concluso: 1° sopra la linea", () => {
    const stage = vistaTabellone(
      dati([girone("A", "iniziale", A), girone("B", "iniziale", B)]),
      { updatedAt: AT },
    );
    const mia = miaPosizione(stage, "a1");
    expect(mia).toMatchObject({
      stato: "in_girone",
      categoria: "M",
      posizione: "1°",
      lato: "sopra",
      taglio: "Sopra la linea: gironi gold",
    });
    expect(miaPosizione(stage, "a4")).toMatchObject({
      lato: "sotto",
      taglio: "Sotto la linea: gironi silver",
    });
  });

  it("girone in corso: «per ora»", () => {
    const stage = vistaTabellone(dati([girone("A", "iniziale", A, 1)]), {
      updatedAt: AT,
    });
    const mia = miaPosizione(stage, "a1");
    expect(mia?.stato === "in_girone" && mia.taglio).toBe(
      "Per ora sopra la linea: gironi gold",
    );
  });

  it("prima di ogni risultato: «–», nessun lato", () => {
    const stage = vistaTabellone(dati([girone("A", "iniziale", A, 0)]), {
      updatedAt: AT,
    });
    expect(miaPosizione(stage, "a1")).toMatchObject({
      posizione: "–",
      lato: null,
      taglio: null,
    });
    expect(stage.boards[0].gironi[0].stato).toBe("da_giocare");
  });

  it("sceglie il girone del livello più avanzato (gold sopra l'iniziale)", () => {
    const gold = girone("Gold A", "gold", ["a2", "b1", "a1", "b2"]);
    const stage = vistaTabellone(
      dati(
        [girone("A", "iniziale", A), girone("B", "iniziale", B), gold],
        "gironi_gold_silver",
      ),
      { updatedAt: AT },
    );
    const mia = miaPosizione(stage, "a1");
    expect(mia?.stato === "in_girone" && mia.girone.nome).toBe("Gold A");
    expect(mia?.stato === "in_girone" && mia.girone.colore).toBe("gold");
    // One gold group: the top 4 reach the gold final.
    expect(mia?.stato === "in_girone" && mia.taglio).toBe(
      "Sopra la linea: finale gold",
    );
  });

  it("finale: nessuna linea, posto in classifica", () => {
    const stage = vistaTabellone(
      dati([girone("Finale gold", "finale_gold", A)], "finali", AT),
      { updatedAt: AT },
    );
    expect(stage.boards[0].fase).toBe("conclusa");
    expect(miaPosizione(stage, "a1")).toMatchObject({
      posizione: "1°",
      lato: null,
      taglio: null,
    });
  });

  it("parità aperta: «2=» e «a pari merito»", () => {
    // Nobody won a match: all four share 1st.
    const ids = A;
    const g: GironeDati = {
      id: "A",
      nome: "A",
      fase: "iniziale",
      categoria: "M",
      giocatori: ids,
      classifica: classificaGirone(ids, [
        partita("x", ids, [{ a: 21, b: 19 }], "programmata"),
      ]),
    };
    const stage = vistaTabellone(dati([g]), { updatedAt: AT });
    const riga = stage.boards[0].gironi[0].rows[0];
    expect(riga.position).toBeNull();
    expect(posizioneBreve({ position: 2, pari: true })).toBe("2=");
    expect(posizioneBreve({ position: 2, pari: false })).toBe("2");
  });

  it("note di ritiro sulle righe (BLVS-42)", () => {
    const d = dati([girone("A", "iniziale", A)]);
    const stage = vistaTabellone(
      { ...d, note: new Map([["a4", "Ritirato"]]) },
      { updatedAt: AT },
    );
    expect(
      stage.boards[0].gironi[0].rows.find((r) => r.playerId === "a4")?.note,
    ).toBe("Ritirato");
  });
});

describe("gironiPerLivello", () => {
  it("prima il livello in gioco, poi quelli giocati; non le proposte", () => {
    const gold = girone("Gold A", "gold", ["a1", "a2", "b1", "b2"]);
    const iniziali = vistaTabellone(
      dati([girone("A", "iniziale", A), gold], "gironi_iniziali"),
      { updatedAt: AT },
    );
    expect(gironiPerLivello(iniziali.boards[0])).toMatchObject({
      correnti: [{ nome: "A" }],
      precedenti: [],
    });
    const avanti = vistaTabellone(
      dati([girone("A", "iniziale", A), gold], "gironi_gold_silver"),
      { updatedAt: AT },
    );
    expect(gironiPerLivello(avanti.boards[0])).toMatchObject({
      correnti: [{ nome: "Gold A" }],
      precedenti: [{ nome: "A" }],
    });
  });
});

describe("testoTaglio", () => {
  it("senza linea: null", () => {
    expect(
      testoTaglio({ taglio: null, stato: "completo" }, { position: 1 }),
    ).toBeNull();
  });
});
