import { describe, expect, it } from "vitest";
import type { Categoria, FaseGirone } from "@/lib/db/types";
import { classificaGirone } from "@/lib/gironi/classifica";
import {
  proponiFinali,
  proponiGoldSilver,
  provenienzaMista,
  verificaSceltaFinali,
  type FinaleDaComporre,
  type GironeClassificato,
} from "./qualificazione";

/**
 * A mixed group: men A, B and women C, D in the two mixed rounds
 * (A+C vs B+D, then A+D vs B+C). `vince` is the winning team of each
 * round, so the result decides who is the best man and the best woman.
 */
function gironeMisto(
  nome: string,
  fase: FaseGirone = "iniziale",
  vince: readonly ("A" | "B")[] = ["A", "A"],
): GironeClassificato {
  const lettera = nome.at(-1)!;
  const id = (l: string) => `${fase}-${lettera}${l}`;
  const iscrizioni = ["A", "B", "C", "D"].map(id);
  const rotazione = [
    [
      ["A", "C"],
      ["B", "D"],
    ],
    [
      ["A", "D"],
      ["B", "C"],
    ],
  ] as const;
  const partite = rotazione.map(([a, b], t) => ({
    id: `${nome}-t${t + 1}`,
    stato: "conclusa" as const,
    squadre: { A: a.map(id), B: b.map(id) },
    sets: [vince[t] === "A" ? { a: 21, b: 15 + t } : { a: 15 + t, b: 21 }],
  }));
  const categorie: Record<string, Categoria> = {
    [id("A")]: "M",
    [id("B")]: "M",
    [id("C")]: "F",
    [id("D")]: "F",
  };
  return {
    id: `g-${fase}-${lettera}`,
    nome,
    fase,
    nomi: Object.fromEntries(iscrizioni.map((i) => [i, `Nome ${i}`])),
    categorie,
    classifica: classificaGirone(iscrizioni, partite),
  };
}

const ids = (g: { giocatori: { iscrizioneId: string }[] }) =>
  g.giocatori.map((p) => p.iscrizioneId);

describe("proponiGoldSilver nel misto", () => {
  it("il miglior uomo e la miglior donna di ogni girone vanno in gold, gli altri in silver", () => {
    // Girone A: A vince entrambe (A miglior uomo); C e D 1 vittoria a testa.
    // Girone B: B vince entrambe.
    const esito = proponiGoldSilver(
      [
        gironeMisto("Girone A", "iniziale", ["A", "A"]),
        gironeMisto("Girone B", "iniziale", ["B", "B"]),
      ],
      undefined,
      { misto: true },
    );
    expect(esito.esito).toBe("ok");
    if (esito.esito !== "ok") return;
    const [gold, silver] = esito.gironi;
    expect(gold.fase).toBe("gold");
    expect(silver.fase).toBe("silver");
    // 2 men then 2 women in every group.
    expect(ids(gold)).toEqual([
      "iniziale-AA",
      "iniziale-BB",
      expect.stringMatching(/^iniziale-A[CD]$/),
      expect.stringMatching(/^iniziale-B[CD]$/),
    ]);
    expect(ids(silver).slice(0, 2)).toEqual(["iniziale-AB", "iniziale-BA"]);
    expect(esito.avvisi).toEqual([]);
    expect(gold.giocatori[0].provenienza).toBe("Miglior uomo · Girone A");
  });

  it("con 4 gironi i nuovi gironi restano 2 uomini + 2 donne", () => {
    const iniziali = ["A", "B", "C", "D"].map((l) =>
      gironeMisto(`Girone ${l}`),
    );
    const esito = proponiGoldSilver(iniziali, undefined, { misto: true });
    expect(esito.esito).toBe("ok");
    if (esito.esito !== "ok") return;
    expect(esito.gironi).toHaveLength(4);
    const categoria = (iscrizioneId: string) =>
      iniziali.find((g) => g.categorie?.[iscrizioneId])!.categorie![
        iscrizioneId
      ];
    for (const g of esito.gironi) {
      expect(ids(g).map(categoria)).toEqual(["M", "M", "F", "F"]);
    }
  });

  it("senza l'opzione resta la regola classica (1° e 2° in gold)", () => {
    const esito = proponiGoldSilver([
      gironeMisto("Girone A"),
      gironeMisto("Girone B"),
    ]);
    expect(esito.esito).toBe("ok");
  });
});

describe("proponiFinali nel misto", () => {
  it("con 2 gironi gold, miglior uomo e miglior donna di ognuno", () => {
    const esito = proponiFinali(
      [
        gironeMisto("Gold A", "gold", ["A", "A"]),
        gironeMisto("Gold B", "gold", ["B", "B"]),
        gironeMisto("Silver A", "silver"),
        gironeMisto("Silver B", "silver"),
      ],
      undefined,
      { misto: true },
    );
    expect(esito.esito).toBe("ok");
    if (esito.esito !== "ok") return;
    const [gold, silver] = esito.gironi;
    expect(gold.fase).toBe("finale_gold");
    expect(ids(gold).slice(0, 2)).toEqual(["gold-AA", "gold-BB"]);
    expect(gold.giocatori).toHaveLength(4);
    expect(silver.fase).toBe("finale_silver");
  });

  it("con 1 girone gold, i suoi 2 uomini e 2 donne", () => {
    const esito = proponiFinali([gironeMisto("Gold A", "gold")], undefined, {
      misto: true,
    });
    expect(esito.esito).toBe("ok");
    if (esito.esito !== "ok") return;
    expect(esito.gironi).toHaveLength(1);
    expect(esito.gironi[0].giocatori).toHaveLength(4);
  });

  it("con 4 gironi gold i finalisti li sceglie l'admin, da un elenco per finale", () => {
    const esito = proponiFinali(
      [
        ...["A", "B", "C", "D"].map((l) => gironeMisto(`Gold ${l}`, "gold")),
        ...["A", "B", "C", "D"].map((l) =>
          gironeMisto(`Silver ${l}`, "silver"),
        ),
      ],
      undefined,
      { misto: true },
    );
    expect(esito.esito).toBe("manuale");
    if (esito.esito !== "manuale") return;
    const [gold, silver] = esito.finali;
    expect(gold).toMatchObject({ fase: "finale_gold", perCategoria: 2 });
    expect(silver.fase).toBe("finale_silver");
    // Tutti i giocatori dei gironi gold: prima gli uomini, i migliori davanti.
    expect(gold.candidati).toHaveLength(16);
    expect(gold.candidati.slice(0, 4).map((c) => c.provenienza)).toEqual([
      "Miglior uomo · Gold A",
      "Miglior uomo · Gold B",
      "Miglior uomo · Gold C",
      "Miglior uomo · Gold D",
    ]);
    expect(gold.candidati[0].dettaglio).toBe("2 vittorie · +11");
    expect(gold.candidati.map((c) => c.categoria).join("")).toBe(
      "MMMMMMMMFFFFFFFF",
    );
  });
});

describe("provenienzaMista", () => {
  it("dice categoria, posto e girone", () => {
    expect(provenienzaMista("F", 1, "Girone C")).toBe(
      "Miglior donna · Girone C",
    );
    expect(provenienzaMista("M", 2, "Girone A")).toBe("2° uomo · Girone A");
    expect(provenienzaMista("F", 2, "Girone A")).toBe("2ª donna · Girone A");
  });
});

describe("verificaSceltaFinali", () => {
  const candidato = (id: string, categoria: "M" | "F") => ({
    iscrizioneId: id,
    nome: `Nome ${id}`,
    provenienza: "Miglior uomo · Gold A",
    categoria,
    dettaglio: "2 vittorie · +11",
  });
  const finali: FinaleDaComporre[] = [
    {
      fase: "finale_gold",
      nome: "Finale gold",
      perCategoria: 2,
      candidati: [
        candidato("m1", "M"),
        candidato("m2", "M"),
        candidato("m3", "M"),
        candidato("f1", "F"),
        candidato("f2", "F"),
        candidato("f3", "F"),
      ],
    },
  ];

  it("accetta 2 uomini + 2 donne tra i candidati, uomini davanti", () => {
    const esito = verificaSceltaFinali(finali, {
      finale_gold: ["f2", "m1", "f1", "m3"],
    });
    expect(esito).toMatchObject({ ok: true });
    if (!esito.ok) return;
    expect(esito.gironi[0].giocatori.map((g) => g.iscrizioneId)).toEqual([
      "m1",
      "m3",
      "f2",
      "f1",
    ]);
  });

  it("rifiuta 3 + 1, un estraneo e un doppione", () => {
    expect(
      verificaSceltaFinali(finali, { finale_gold: ["m1", "m2", "m3", "f1"] }),
    ).toEqual({
      ok: false,
      messaggio: "Finale gold: scegli 2 uomini e 2 donne.",
    });
    expect(
      verificaSceltaFinali(finali, { finale_gold: ["m1", "m2", "x", "f1"] }),
    ).toMatchObject({ ok: false });
    expect(
      verificaSceltaFinali(finali, { finale_gold: ["m1", "m1", "f1", "f2"] }),
    ).toMatchObject({ ok: false });
  });
});
