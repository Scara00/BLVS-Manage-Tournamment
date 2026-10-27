import { describe, expect, it } from "vitest";
import type { FaseGioco } from "@/lib/db/types";
import { partiteFaseGioco } from "@/lib/tappe/live-admin/format";
import type { PartitaLive } from "@/lib/tappe/live-admin/types";
import {
  annuncioFase,
  FASE_GIOCO_LABEL,
  faseDopo,
  prossimoNomeGirone,
} from "./fase";
import { vistaProssimaFase, type DatiProssimaFase } from "./vista";

const dati = (
  faseGioco: FaseGioco | null,
  extra: Partial<DatiProssimaFase> = {},
): DatiProssimaFase => ({
  tappa: { id: "t1", nome: "Tappa 1" },
  categoria: "M",
  faseGioco,
  proposta: false,
  gironi: [],
  ...extra,
});

describe("fase del tabellone", () => {
  it("è sempre a testo, nell'ordine iniziali → gold e silver → finali", () => {
    expect(FASE_GIOCO_LABEL).toEqual({
      gironi_iniziali: "Gironi iniziali",
      gironi_gold_silver: "Gironi gold e silver",
      finali: "Finali",
    });
    expect(faseDopo("finali", "gironi_gold_silver")).toBe(true);
    expect(faseDopo("gironi_iniziali", null)).toBe(true);
    expect(faseDopo("gironi_iniziali", "gironi_iniziali")).toBe(false);
  });

  it("annuncia l'avvio di ogni fase alle pagine live", () => {
    expect(annuncioFase("gironi_gold_silver", 12)).toBe(
      "iniziati i gironi gold e silver, 12 partite da giocare",
    );
    expect(annuncioFase("finali", 6)).toBe(
      "generate le finali, 6 partite da giocare",
    );
  });

  it("dà nomi gold e silver come il DB", () => {
    expect(prossimoNomeGirone([{ nome: "Gold A" }], "gold")).toBe("Gold B");
    expect(prossimoNomeGirone([], "silver")).toBe("Silver A");
    expect(prossimoNomeGirone([{ nome: "Gold A" }])).toBe("Girone A");
  });
});

describe("vistaProssimaFase", () => {
  it("la proposta gold/silver vale solo durante i gironi iniziali", () => {
    expect(vistaProssimaFase("gold_silver", dati(null))).toBeNull();
    expect(
      vistaProssimaFase("gold_silver", dati("gironi_gold_silver")),
    ).toBeNull();
    expect(
      vistaProssimaFase(
        "gold_silver",
        dati("gironi_iniziali", { proposta: true }),
      )?.stato,
    ).toBe("proposta");
  });

  it("le finali compaiono dopo l'avvio di gold e silver", () => {
    expect(vistaProssimaFase("finali", dati("gironi_iniziali"))).toBeNull();
    expect(vistaProssimaFase("finali", dati("finali"))?.stato).toBe("fatta");
  });

  it("«Risolvi parità» porta al girone nell'editor", () => {
    const vista = vistaProssimaFase(
      "gold_silver",
      dati("gironi_iniziali", {
        gironi: [
          {
            id: "g1",
            nome: "Girone A",
            fase: "iniziale",
            nomi: {},
            classifica: {
              righe: [],
              parita: [{ iscrizioni: ["a", "b"], firma: "x", posizione: 2 }],
              stato: "da_risolvere",
            },
          },
        ],
      }),
    );
    expect(vista?.stato).toBe("parita");
    expect(vista?.gironi).toEqual([
      {
        id: "g1",
        nome: "Girone A",
        href: "/admin/tappe/t1/gironi/m#girone-g1",
      },
    ]);
  });
});

describe("avanzamento della fase in gestione live", () => {
  const partita = (id: string, gironeFase?: PartitaLive["gironeFase"]) =>
    ({ id, gironeFase }) as PartitaLive;

  it("conta solo le partite della fase di gioco attuale", () => {
    const partite = [
      partita("i1", "iniziale"),
      partita("i2"),
      partita("g1", "gold"),
      partita("s1", "silver"),
      partita("f1", "finale_gold"),
    ];
    expect(
      partiteFaseGioco(partite, "gironi_iniziali").map((p) => p.id),
    ).toEqual(["i1", "i2"]);
    expect(
      partiteFaseGioco(partite, "gironi_gold_silver").map((p) => p.id),
    ).toEqual(["g1", "s1"]);
    expect(partiteFaseGioco(partite, "finali").map((p) => p.id)).toEqual([
      "f1",
    ]);
  });
});
