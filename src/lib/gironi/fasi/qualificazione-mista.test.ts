import { describe, expect, it } from "vitest";
import type { Categoria, FaseGirone } from "@/lib/db/types";
import type { RigaClassifica } from "@/lib/gironi/classifica";
import {
  proponiFinali,
  proponiGoldSilver,
  provenienzaMista,
  verificaSceltaFinali,
  type FinaleDaComporre,
  type GironeClassificato,
} from "./qualificazione";

const UOMINI = "ABCD";

/**
 * A played mixed group of 4 men (A-D) + 4 women (E-H). The standing is
 * given directly, best first (`ordine`, by letter), so each test says who
 * the best men and women are without inventing the 8 results.
 */
function gironeMisto(
  nome: string,
  fase: FaseGirone = "iniziale",
  ordine = "AEBFCGDH",
): GironeClassificato {
  const lettera = nome.at(-1)!;
  const id = (l: string) => `${fase}-${lettera}${l}`;
  const righe: RigaClassifica[] = ordine.split("").map((l, i) => ({
    iscrizioneId: id(l),
    giocate: 4,
    vinte: 4 - Math.floor(i / 2),
    puntiFatti: 84 - i,
    puntiSubiti: 70 + i,
    differenza: 14 - 2 * i,
    posizione: i + 1,
    decisoDa: null,
    daRisolvere: false,
  }));
  const categorie: Record<string, Categoria> = Object.fromEntries(
    "ABCDEFGH"
      .split("")
      .map((l) => [id(l), UOMINI.includes(l) ? "M" : "F"] as const),
  );
  return {
    id: `g-${fase}-${lettera}`,
    nome,
    fase,
    nomi: Object.fromEntries(
      righe.map((r) => [r.iscrizioneId, `Nome ${r.iscrizioneId}`]),
    ),
    categorie,
    classifica: { righe, parita: [], stato: "completo" },
  };
}

const ids = (g: { giocatori: { iscrizioneId: string }[] }) =>
  g.giocatori.map((p) => p.iscrizioneId);

/** The initial group a registration id comes from: `iniziale-<group><letter>`. */
const gironeDi = (iscrizioneId: string) => iscrizioneId.split("-")[1][0];
const categoriaDi = (iscrizioneId: string): Categoria =>
  UOMINI.includes(iscrizioneId.at(-1)!) ? "M" : "F";

describe("proponiGoldSilver nel misto", () => {
  it("i 2 migliori uomini e le 2 migliori donne vanno in gold, gli altri in silver", () => {
    // Girone A: uomini A > B > C > D, donne E > F > G > H.
    // Girone B: uomini B > A > D > C, donne F > E > H > G.
    const esito = proponiGoldSilver(
      [
        gironeMisto("Girone A", "iniziale", "AEBFCGDH"),
        gironeMisto("Girone B", "iniziale", "BFAEDHCG"),
      ],
      undefined,
      { misto: true },
    );
    expect(esito.esito).toBe("ok");
    if (esito.esito !== "ok") return;
    const [gold, silver] = esito.gironi;
    expect(esito.gironi).toHaveLength(2);
    expect(gold.fase).toBe("gold");
    expect(silver.fase).toBe("silver");
    // 4 men then 4 women in every group.
    expect(ids(gold)).toEqual([
      "iniziale-AA",
      "iniziale-BB",
      "iniziale-AB",
      "iniziale-BA",
      "iniziale-AE",
      "iniziale-BF",
      "iniziale-AF",
      "iniziale-BE",
    ]);
    expect(ids(silver)).toEqual([
      "iniziale-AC",
      "iniziale-BD",
      "iniziale-AD",
      "iniziale-BC",
      "iniziale-AG",
      "iniziale-BH",
      "iniziale-AH",
      "iniziale-BG",
    ]);
    expect(esito.avvisi).toEqual([]);
    expect(gold.giocatori.map((g) => g.provenienza).slice(0, 5)).toEqual([
      "Miglior uomo · Girone A",
      "Miglior uomo · Girone B",
      "2° uomo · Girone A",
      "2° uomo · Girone B",
      "Miglior donna · Girone A",
    ]);
  });

  it("con 4 gironi ognuno manda un uomo e una donna a ogni girone gold", () => {
    const iniziali = ["A", "B", "C", "D"].map((l) =>
      gironeMisto(`Girone ${l}`),
    );
    const esito = proponiGoldSilver(iniziali, undefined, { misto: true });
    expect(esito.esito).toBe("ok");
    if (esito.esito !== "ok") return;
    expect(esito.gironi.map((g) => g.fase)).toEqual([
      "gold",
      "gold",
      "silver",
      "silver",
    ]);
    for (const g of esito.gironi) {
      expect(ids(g).map(categoriaDi).join("")).toBe("MMMMFFFF");
      for (const iniziale of ["A", "B", "C", "D"]) {
        const daLi = ids(g).filter((i) => gironeDi(i) === iniziale);
        expect(daLi.map(categoriaDi).sort()).toEqual(["F", "M"]);
      }
    }
    expect(esito.avvisi).toEqual([]);
  });

  it("con un numero dispari di gironi l'ultimo resta da completare nell'editor", () => {
    const esito = proponiGoldSilver(
      ["A", "B", "C"].map((l) => gironeMisto(`Girone ${l}`)),
      undefined,
      { misto: true },
    );
    expect(esito.esito).toBe("ok");
    if (esito.esito !== "ok") return;
    const gold = esito.gironi.filter((g) => g.fase === "gold");
    expect(gold.map((g) => g.giocatori.length)).toEqual([8, 4]);
    expect(esito.avvisi).toContain(
      `${gold[1].nome}: 4 giocatori invece di 8. Completalo nell'editor prima dell'avvio.`,
    );
  });

  it("senza l'opzione resta la regola classica", () => {
    const esito = proponiGoldSilver([
      gironeMisto("Girone A"),
      gironeMisto("Girone B"),
    ]);
    expect(esito.esito).toBe("ok");
  });
});

describe("proponiFinali nel misto", () => {
  const gironi = (fase: "gold" | "silver", n: number) =>
    ["A", "B", "C", "D"]
      .slice(0, n)
      .map((l) =>
        gironeMisto(`${fase === "gold" ? "Gold" : "Silver"} ${l}`, fase),
      );

  it("con 2 gironi gold, i 2 migliori uomini e le 2 migliori donne di ognuno", () => {
    const esito = proponiFinali(
      [...gironi("gold", 2), ...gironi("silver", 2)],
      undefined,
      { misto: true },
    );
    expect(esito.esito).toBe("ok");
    if (esito.esito !== "ok") return;
    const [gold, silver] = esito.gironi;
    expect(gold.fase).toBe("finale_gold");
    expect(ids(gold)).toEqual([
      "gold-AA",
      "gold-BA",
      "gold-AB",
      "gold-BB",
      "gold-AE",
      "gold-BE",
      "gold-AF",
      "gold-BF",
    ]);
    expect(silver.fase).toBe("finale_silver");
    expect(silver.giocatori).toHaveLength(8);
  });

  it("con 1 girone gold, i suoi 4 uomini e 4 donne", () => {
    const esito = proponiFinali(gironi("gold", 1), undefined, { misto: true });
    expect(esito.esito).toBe("ok");
    if (esito.esito !== "ok") return;
    expect(esito.gironi).toHaveLength(1);
    expect(ids(esito.gironi[0]).map(categoriaDi).join("")).toBe("MMMMFFFF");
  });

  it("con 4 gironi gold, il miglior uomo e la miglior donna di ognuno", () => {
    const esito = proponiFinali(gironi("gold", 4), undefined, { misto: true });
    expect(esito.esito).toBe("ok");
    if (esito.esito !== "ok") return;
    expect(ids(esito.gironi[0])).toEqual([
      "gold-AA",
      "gold-BA",
      "gold-CA",
      "gold-DA",
      "gold-AE",
      "gold-BE",
      "gold-CE",
      "gold-DE",
    ]);
  });

  it("con 3 gironi gold i finalisti li sceglie l'admin, da un elenco per finale", () => {
    const esito = proponiFinali(
      [...gironi("gold", 3), ...gironi("silver", 3)],
      undefined,
      { misto: true },
    );
    expect(esito.esito).toBe("manuale");
    if (esito.esito !== "manuale") return;
    const [gold, silver] = esito.finali;
    expect(gold).toMatchObject({ fase: "finale_gold", perCategoria: 4 });
    expect(silver.fase).toBe("finale_silver");
    // Tutti i giocatori dei gironi gold: prima gli uomini, i migliori davanti.
    expect(gold.candidati).toHaveLength(24);
    expect(gold.candidati.slice(0, 4).map((c) => c.provenienza)).toEqual([
      "Miglior uomo · Gold A",
      "Miglior uomo · Gold B",
      "Miglior uomo · Gold C",
      "2° uomo · Gold A",
    ]);
    expect(gold.candidati[0].dettaglio).toBe("4 vittorie · +14");
    expect(gold.candidati.map((c) => c.categoria).join("")).toBe(
      "M".repeat(12) + "F".repeat(12),
    );
  });

  it("senza l'opzione resta la finale classica da 4", () => {
    const esito = proponiFinali(gironi("gold", 1));
    expect(esito.esito).toBe("ok");
    if (esito.esito !== "ok") return;
    expect(esito.gironi[0].giocatori).toHaveLength(4);
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
    dettaglio: "4 vittorie · +14",
  });
  const finali: FinaleDaComporre[] = [
    {
      fase: "finale_gold",
      nome: "Finale gold",
      perCategoria: 4,
      candidati: [
        ...["m1", "m2", "m3", "m4", "m5"].map((id) => candidato(id, "M")),
        ...["f1", "f2", "f3", "f4", "f5"].map((id) => candidato(id, "F")),
      ],
    },
  ];

  it("accetta 4 uomini + 4 donne tra i candidati, uomini davanti", () => {
    const esito = verificaSceltaFinali(finali, {
      finale_gold: ["f2", "m1", "f1", "m3", "f4", "m5", "f3", "m2"],
    });
    expect(esito).toMatchObject({ ok: true });
    if (!esito.ok) return;
    expect(esito.gironi[0].giocatori.map((g) => g.iscrizioneId)).toEqual([
      "m1",
      "m3",
      "m5",
      "m2",
      "f2",
      "f1",
      "f4",
      "f3",
    ]);
  });

  it("rifiuta 5 + 3, un estraneo e un doppione", () => {
    expect(
      verificaSceltaFinali(finali, {
        finale_gold: ["m1", "m2", "m3", "m4", "m5", "f1", "f2", "f3"],
      }),
    ).toEqual({
      ok: false,
      messaggio: "Finale gold: scegli 4 uomini e 4 donne.",
    });
    expect(
      verificaSceltaFinali(finali, {
        finale_gold: ["m1", "m2", "m3", "x", "f1", "f2", "f3", "f4"],
      }),
    ).toMatchObject({ ok: false });
    expect(
      verificaSceltaFinali(finali, {
        finale_gold: ["m1", "m1", "m2", "m3", "f1", "f2", "f3", "f4"],
      }),
    ).toMatchObject({ ok: false });
  });
});
