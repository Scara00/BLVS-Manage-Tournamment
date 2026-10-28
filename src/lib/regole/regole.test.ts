import { describe, expect, it } from "vitest";
import { spiegaRegolaGenerale } from "@/lib/classifica-generale/spareggi";
import { spiegaRegolaClassifica } from "@/lib/gironi/classifica/criteri";
import { PUNTI_PER_POSIZIONE } from "@/lib/tappe/classifica/punti";
import { REGOLE_APERTE, daConfermare } from "./aperte";
import { regoleHref } from "./paths";
import {
  CONFIG_REGOLE,
  elencoPosti,
  introPunti,
  regoleDelCircuito,
  type ConfigRegole,
} from "./regole";

const con = (parziale: Partial<ConfigRegole>): ConfigRegole => ({
  ...CONFIG_REGOLE,
  ...parziale,
});

describe("testo generato dalla configurazione (BLVS-46)", () => {
  it("tre passi del formato, nell'ordine delle fasi", () => {
    const { formato } = regoleDelCircuito();
    expect(formato.contenuto.map((p) => [p.numero, p.titolo])).toEqual([
      [1, "Gironi iniziali"],
      [2, "Gironi gold e silver"],
      [3, "Finali"],
    ]);
    expect(formato.contenuto[0].testo).toContain("gironi da 4 giocatori");
    expect(formato.contenuto[0].testo).toContain("3 partite King/Queen");
    expect(formato.contenuto[1].testo).toContain(
      "Chi arriva 1° o 2° nel girone iniziale va nei gironi Gold; chi arriva 3° o 4° va nei gironi Silver.",
    );
    expect(formato.contenuto[2].testo).toContain("da 4 giocatori");
  });

  it("il formato segue la regola di qualificazione e delle finali", () => {
    const { formato } = regoleDelCircuito(
      con({
        giocatoriGirone: 5,
        partiteGirone: 5,
        qualificazione: { gold: [1], silver: [2, 3, 4] },
        finali: { giocatori: 6 },
      }),
    );
    expect(formato.contenuto[0].testo).toContain("gironi da 5 giocatori");
    expect(formato.contenuto[0].testo).toContain("5 partite");
    expect(formato.contenuto[1].testo).toContain(
      "Chi arriva 1° nel girone iniziale va nei gironi Gold; chi arriva 2°, 3° o 4° va nei gironi Silver.",
    );
    expect(formato.contenuto[2].testo).toContain("da 6 giocatori");
  });

  it("il set segue REGOLA_SET", () => {
    expect(regoleDelCircuito().set.contenuto).toContain("Si vince a 21");
    const { set } = regoleDelCircuito(con({ set: { punti: 15, scarto: 3 } }));
    expect(set.contenuto).toBe(
      "Si vince a 15 con almeno 3 punti di scarto; oltre i 15 si gioca finché una squadra va avanti di 3.",
    );
  });

  it("gli spareggi del girone sono quelli della classifica, nello stesso ordine", () => {
    expect(regoleDelCircuito().spareggiGirone.contenuto).toEqual(
      spiegaRegolaClassifica(),
    );
    const regola = {
      criteri: ["differenza_punti", "vittorie"] as const,
    };
    const testi = regoleDelCircuito(con({ classifica: regola })).spareggiGirone
      .contenuto;
    expect(testi).toEqual(spiegaRegolaClassifica(regola));
    expect(testi[0]).toContain("differenza");
    expect(testi).toHaveLength(3);
  });

  it("gli spareggi della classifica generale seguono REGOLA_GENERALE", () => {
    expect(regoleDelCircuito().spareggiGenerale.contenuto).toEqual(
      spiegaRegolaGenerale(),
    );
    const regola = { criteri: ["punti"] as const };
    expect(
      regoleDelCircuito(con({ generale: regola })).spareggiGenerale.contenuto,
    ).toEqual(spiegaRegolaGenerale(regola));
  });

  it("la tabella dei punti viene da PUNTI_PER_POSIZIONE", () => {
    expect(regoleDelCircuito().punti.contenuto).toEqual(
      PUNTI_PER_POSIZIONE.gold.map((gold, i) => ({
        posizione: i + 1,
        gold,
        silver: PUNTI_PER_POSIZIONE.silver[i],
      })),
    );
    const punti = { gold: [20, 10, 5], silver: [9] };
    expect(regoleDelCircuito(con({ punti })).punti.contenuto).toEqual([
      { posizione: 1, gold: 20, silver: 9 },
      { posizione: 2, gold: 10, silver: 0 },
      { posizione: 3, gold: 5, silver: 0 },
    ]);
    const intro = introPunti(regoleDelCircuito(con({ punti })).punti.contenuto);
    expect(intro).toContain("finale Gold prende 20 punti");
    expect(intro).toContain("finale Silver 9");
  });
});

describe("regole da confermare (R-46)", () => {
  it("Q-01, Q-03, Q-04 e Q-06 sono aperte; i punti no", () => {
    const r = regoleDelCircuito();
    expect(r.formato.daConfermare).toBe(true);
    expect(r.spareggiGirone.daConfermare).toBe(true);
    expect(r.set.daConfermare).toBe(true);
    expect(r.spareggiGenerale.daConfermare).toBe(true);
    expect(r.punti.daConfermare).toBe(false);
    expect(Object.keys(REGOLE_APERTE).sort()).toEqual([
      "Q-01",
      "Q-03",
      "Q-04",
      "Q-06",
    ]);
  });

  it("una regola confermata perde l'etichetta", () => {
    const aperte = { ...REGOLE_APERTE };
    delete (aperte as Partial<typeof aperte>)["Q-04"];
    expect(daConfermare("set", aperte)).toBe(false);
    const r = regoleDelCircuito(con({ aperte }));
    expect(r.set.daConfermare).toBe(false);
    expect(r.formato.daConfermare).toBe(true);
  });
});

describe("elencoPosti e percorsi", () => {
  it.each([
    [[1], "1°"],
    [[1, 2], "1° o 2°"],
    [[1, 2, 3], "1°, 2° o 3°"],
  ])("%j → %s", (posti, testo) => {
    expect(elencoPosti(posti)).toBe(testo);
  });

  it("link alle sezioni", () => {
    expect(regoleHref()).toBe("/regole");
    expect(regoleHref("spareggiGenerale")).toBe("/regole#classifica-generale");
  });
});
