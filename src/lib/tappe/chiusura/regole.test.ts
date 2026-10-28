import { describe, expect, it } from "vitest";
import type { FaseGirone, SetPunteggio, StatoPartita } from "@/lib/db/types";
import { faseDelTabellone, FASE_TABELLONE_LABEL } from "@/lib/gironi/fasi/fase";
import { classificaTappa } from "@/lib/tappe/classifica/classifica";
import type { PartitaLive } from "@/lib/tappe/live-admin/types";
import { descriviBlocco } from "./format";
import {
  bloccoChiusura,
  conSetsCorretti,
  finaliConcluse,
  finaliDaPartite,
  partiteDaConcludere,
} from "./regole";

const ROTAZIONE = [
  [0, 1, 2, 3],
  [0, 2, 1, 3],
  [0, 3, 1, 2],
];

const g = (fase: string, k: number) => ({
  iscrizioneId: `${fase}-${k}`,
  nome: String.fromCharCode(65 + k),
  cognome: fase === "finale_gold" ? "Gold" : "Silver",
});

/** A final of 4: A wins every round with `sets` (no tie by default). */
function finale(
  fase: FaseGirone,
  sets: SetPunteggio[][] = [
    [{ a: 21, b: 10 }],
    [{ a: 21, b: 12 }],
    [{ a: 21, b: 14 }],
  ],
  stato: StatoPartita = "conclusa",
): PartitaLive[] {
  return ROTAZIONE.map(([a1, a2, b1, b2], t) => ({
    id: `${fase}-t${t + 1}`,
    fase: "finale",
    gironeId: fase,
    gironeNome: fase === "finale_gold" ? "Finale gold" : "Finale silver",
    gironeFase: fase,
    gironePosizione: 1,
    turno: t + 1,
    campo: null,
    programmataIl: null,
    stato,
    squadraA: [g(fase, a1), g(fase, a2)],
    squadraB: [g(fase, b1), g(fase, b2)],
    sets: sets[t],
    versione: 2,
  }));
}

const finali = () => [...finale("finale_gold"), ...finale("finale_silver")];

function blocco(partite: PartitaLive[], extra = {}) {
  return bloccoChiusura({
    statoTappa: "in_corso",
    faseGioco: "finali",
    conclusoIl: null,
    partite,
    classifica: classificaTappa({
      finali: finaliDaPartite(partite),
      concluso: false,
    }),
    ...extra,
  });
}

describe("fase del tabellone", () => {
  it("passa a «Conclusa» quando il tabellone è chiuso", () => {
    expect(faseDelTabellone("finali", null)).toBe("finali");
    expect(faseDelTabellone(null, null)).toBeNull();
    const fase = faseDelTabellone("finali", "2027-06-13T18:00:00Z");
    expect(fase).toBe("conclusa");
    expect(FASE_TABELLONE_LABEL[fase!]).toBe("Conclusa");
  });
});

describe("regole di blocco", () => {
  it("con entrambe le finali concluse senza parità si può concludere", () => {
    expect(finaliConcluse("finali", finali())).toBe(true);
    expect(blocco(finali())).toBeNull();
  });

  it("una partita non conclusa blocca, e si dice quante", () => {
    const partite = finali().map((p, i) =>
      i === 5 ? { ...p, stato: "in_corso" as const, sets: [] } : p,
    );
    expect(finaliConcluse("finali", partite)).toBe(false);
    const b = blocco(partite);
    expect(b).toEqual({ motivo: "partite", daConcludere: 1 });
    expect(descriviBlocco(b!)).toBe(
      "Non si può concludere: 1 partita non è conclusa con una squadra vincente.",
    );
  });

  it("una partita conclusa senza vincitore blocca", () => {
    const partite = finali().map((p, i) =>
      i === 0
        ? {
            ...p,
            sets: [
              { a: 21, b: 15 },
              { a: 15, b: 21 },
            ],
          }
        : p,
    );
    expect(partiteDaConcludere(partite)).toHaveLength(1);
    expect(blocco(partite)?.motivo).toBe("partite");
  });

  it("una parità perfetta da risolvere blocca e indica la finale", () => {
    const parita = [...Array(3)].map(() => [{ a: 21, b: 19 }]);
    const partite = [
      ...finale("finale_gold", parita),
      ...finale("finale_silver"),
    ];
    const b = blocco(partite);
    expect(b).toEqual({
      motivo: "parita",
      finali: [{ gironeId: "finale_gold", nome: "Finale gold" }],
    });
    expect(descriviBlocco(b!)).toContain("parità da risolvere (Finale gold)");
  });

  it("fuori dalle finali, a tappa non in corso o già concluso blocca", () => {
    expect(blocco(finali(), { faseGioco: "gironi_gold_silver" })).toEqual({
      motivo: "fase",
    });
    expect(blocco(finale("finale_gold"))).toEqual({ motivo: "fase" });
    expect(blocco(finali(), { statoTappa: "conclusa" })).toEqual({
      motivo: "tappa",
      stato: "conclusa",
    });
    expect(blocco(finali(), { conclusoIl: "2027-06-13T18:00:00Z" })).toEqual({
      motivo: "concluso",
    });
  });
});

describe("punti: da provvisori a definitivi", () => {
  it("restano provvisori finché il tabellone è aperto", () => {
    const aperta = classificaTappa({
      finali: finaliDaPartite(finali()),
      concluso: false,
    });
    expect(aperta.puntiProvvisori).toBe(true);
    expect(aperta.righe.every((r) => r.puntiProvvisori)).toBe(true);
    expect(aperta.stato).toBe("definitiva");

    const chiusa = classificaTappa({
      finali: finaliDaPartite(finali()),
      concluso: true,
    });
    expect(chiusa.puntiProvvisori).toBe(false);
    expect(chiusa.righe.some((r) => r.puntiProvvisori)).toBe(false);
    expect(chiusa.stato).toBe("conclusa");
    // Same places and points, only no longer provisional.
    expect(chiusa.righe.map((r) => [r.posizione, r.punti])).toEqual(
      aperta.righe.map((r) => [r.posizione, r.punti]),
    );
    expect(chiusa.righe.map((r) => r.punti)).toEqual([12, 8, 4, 2, 8, 6, 2, 1]);
  });

  it("una correzione ricalcola i punti sulle finali corrette", () => {
    const base = finaliDaPartite(finali());
    const corretta = conSetsCorretti(base, "finale_gold-t1", [
      { a: 10, b: 21 },
    ]);
    expect(
      corretta[0].partite.find((p) => p.id === "finale_gold-t1")?.sets,
    ).toEqual([{ a: 10, b: 21 }]);
    // The original is untouched.
    expect(base[0].partite[0].sets).toEqual([{ a: 21, b: 10 }]);
  });
});
