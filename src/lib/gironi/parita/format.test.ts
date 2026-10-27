import { describe, expect, it } from "vitest";
import { classificaGirone, type PartitaGirone } from "@/lib/gironi/classifica";
import {
  annuncioOrdine,
  annuncioScambio,
  componiMotivo,
  daRisolvere,
  erroriMotivo,
  formatValore,
  leggiRichiestaParita,
  motivoDaTesto,
  ordineCambiato,
  paritaGirone,
  scambia,
  titoloParita,
  type DatiParitaGirone,
} from "./format";
import { PARITA_MESSAGES as M, NOTE_PARITA_MAX } from "./types";

const NOMI = ["Luca Rossi", "Marco Bianchi", "Paolo Marino", "Andrea Greco"];
const IDS = ["a", "b", "c", "d"];

/** A wins all three matches 21–19: b, c and d are level in everything. */
function partite(stato: PartitaGirone["stato"] = "conclusa"): PartitaGirone[] {
  return [
    ["b", ["c", "d"]],
    ["c", ["b", "d"]],
    ["d", ["b", "c"]],
  ].map(([compagno, altri], i) => ({
    id: `t${i + 1}`,
    stato: i === 2 ? stato : "conclusa",
    squadre: { A: ["a", compagno as string], B: altri as string[] },
    sets: [{ a: 21, b: 19 }],
  }));
}

function dati(over: Partial<DatiParitaGirone> = {}): DatiParitaGirone {
  return {
    tappaId: "t",
    categoria: "M",
    gironeId: "g1",
    gironeNome: "Girone A",
    giocatori: IDS.map((iscrizioneId, i) => ({
      iscrizioneId,
      nome: NOMI[i],
    })),
    partite: partite(),
    decisioni: [],
    ...over,
  };
}

const FIRMA = "b:3/1/59/61|c:3/1/59/61|d:3/1/59/61";

describe("paritaGirone", () => {
  it("mostra la parità perfetta di un girone finito con i valori di ogni criterio", () => {
    const girone = paritaGirone(dati());
    expect(girone.parita).toHaveLength(1);
    const [p] = girone.parita;
    expect(p.firma).toBe(FIRMA);
    expect(p.posizione).toBe(2);
    expect(p.decisione).toBeNull();
    expect(p.giocatori.map((g) => g.nome)).toEqual(NOMI.slice(1));
    expect(
      p.criteri.map((c) => [c.etichetta, c.valori.map((v) => v.valore)]),
    ).toEqual([
      ["Vittorie", [1, 1, 1]],
      ["Scontri diretti", [1, 1, 1]],
      ["Differenza punti", [-2, -2, -2]],
      ["Punti fatti", [59, 59, 59]],
    ]);
    expect(daRisolvere(girone)).toBe(true);
  });

  it("non segnala parità mentre il girone si gioca", () => {
    const girone = paritaGirone(dati({ partite: partite("programmata") }));
    expect(girone.parita).toEqual([]);
  });

  it("una parità decisa resta visibile, nell'ordine scelto, per poterla modificare", () => {
    const girone = paritaGirone(
      dati({
        decisioni: [
          { firma: FIRMA, ordine: ["d", "b", "c"], motivo: "Sorteggio" },
        ],
      }),
    );
    const [p] = girone.parita;
    expect(p.decisione).toEqual({ motivo: "Sorteggio" });
    expect(p.giocatori.map((g) => g.iscrizioneId)).toEqual(["d", "b", "c"]);
    expect(daRisolvere(girone)).toBe(false);
  });

  it("una decisione con un'altra firma non vale più", () => {
    const girone = paritaGirone(
      dati({
        decisioni: [{ firma: "vecchia", ordine: ["d", "b", "c"], motivo: "x" }],
      }),
    );
    expect(girone.parita[0].decisione).toBeNull();
  });
});

describe("applicazione dell'ordine", () => {
  it("lo scambio deciso diventa la classifica del girone", () => {
    const iniziale = paritaGirone(dati()).parita[0].giocatori.map(
      (g) => g.iscrizioneId,
    );
    const ordine = scambia(scambia(iniziale, 1), 0); // b,c,d → b,d,c → d,b,c
    expect(ordine).toEqual(["d", "b", "c"]);
    const classifica = classificaGirone(IDS, partite(), {
      decisioni: [{ firma: FIRMA, ordine }],
    });
    expect(classifica.stato).toBe("completo");
    expect(
      classifica.righe.map((r) => [r.iscrizioneId, r.posizione, r.decisoDa]),
    ).toEqual([
      ["a", 1, "vittorie"],
      ["d", 2, "admin"],
      ["b", 3, "admin"],
      ["c", 4, "admin"],
    ]);
  });

  it("scambia solo vicini esistenti, senza toccare l'originale", () => {
    const ordine = ["x", "y", "z"];
    expect(scambia(ordine, 1)).toEqual(["x", "z", "y"]);
    expect(scambia(ordine, 2)).toEqual(ordine);
    expect(scambia(ordine, -1)).toEqual(ordine);
    expect(ordine).toEqual(["x", "y", "z"]);
    expect(ordineCambiato(ordine, ["x", "z", "y"])).toBe(true);
    expect(ordineCambiato(ordine, [...ordine])).toBe(false);
  });
});

describe("testi", () => {
  it("annuncia lo scambio e l'ordine deciso a parole", () => {
    expect(annuncioScambio(2, ["Marco Bianchi", "Luca Rossi"])).toBe(
      "Ordine: 2º Marco Bianchi, 3º Luca Rossi.",
    );
    expect(annuncioOrdine("Girone A", 1, ["A B", "C D"])).toBe(
      "Girone A: ordine deciso. 1º A B, 2º C D.",
    );
    expect(titoloParita(2, 2)).toBe("Parità per il 2º posto");
    expect(titoloParita(2, 3)).toBe("Parità dal 2º al 4º posto");
    expect(formatValore("differenza_punti", -2)).toBe("−2");
    expect(formatValore("differenza_punti", 3)).toBe("+3");
    expect(formatValore("vittorie", 0)).toBe("0");
  });
});

describe("motivo", () => {
  it("compone il motivo predefinito con il dettaglio, e lo rilegge", () => {
    expect(componiMotivo("sorteggio", "")).toBe("Sorteggio");
    expect(componiMotivo("sorteggio", "  monetina   al campo 2 ")).toBe(
      "Sorteggio: monetina al campo 2",
    );
    expect(componiMotivo("altro", "Decide il giudice")).toBe(
      "Decide il giudice",
    );
    expect(motivoDaTesto("Sorteggio: monetina")).toEqual({
      motivo: "sorteggio",
      note: "monetina",
    });
    expect(motivoDaTesto("Accordo tra i giocatori")).toEqual({
      motivo: "accordo",
      note: "",
    });
    expect(motivoDaTesto("Decide il giudice")).toEqual({
      motivo: "altro",
      note: "Decide il giudice",
    });
  });

  it("chiede il motivo, e il dettaglio per «Altro»", () => {
    expect(erroriMotivo(null, "")).toEqual({ motivo: M.motivoMancante });
    expect(erroriMotivo("boh", "")).toEqual({ motivo: M.motivoMancante });
    expect(erroriMotivo("altro", "  ")).toEqual({ note: M.noteMancanti });
    expect(erroriMotivo("sorteggio", "x".repeat(NOTE_PARITA_MAX + 1))).toEqual({
      note: M.noteLunghe,
    });
    expect(erroriMotivo("sorteggio", "")).toBeNull();
  });
});

describe("leggiRichiestaParita", () => {
  it("legge l'ordine nell'ordine dei campi", () => {
    const data = new FormData();
    for (const [k, v] of [
      ["tappaId", "t"],
      ["categoria", "M"],
      ["gironeId", "g1"],
      ["firma", FIRMA],
      ["ordine", "d"],
      ["ordine", "b"],
      ["motivo", "sorteggio"],
    ]) {
      data.append(k, v);
    }
    expect(leggiRichiestaParita(data)).toMatchObject({
      categoria: "M",
      ordine: ["d", "b"],
      motivo: "sorteggio",
      note: "",
    });
    data.set("categoria", "X");
    expect(leggiRichiestaParita(data)).toBeNull();
  });
});
