import { describe, expect, it } from "vitest";
import {
  toIscrizioneConfermata,
  toTappaDettaglio,
  type DettaglioTappaRow,
  type TabelloneTappaRow,
} from "./dettaglio";

const ROW: DettaglioTappaRow = {
  id: "t1",
  nome: "Tappa 2 · Rimini",
  luogo: "Rimini, Bagno 26",
  data_inizio: "2027-06-26",
  data_fine: "2027-06-27",
  stato: "iscrizioni_aperte",
  iscrizioni_aprono_il: "2027-05-15T07:00:00Z",
  iscrizioni_chiudono_il: "2027-06-19T21:59:00Z",
  ritrovo: "Bagno 26",
  ritrovo_alle: "2027-06-26T06:30:00Z",
  programma: "Sabato: gironi.",
  annullabile_fino_al: null,
};

const BOARDS: TabelloneTappaRow[] = [
  { categoria: "F", posti: 12, occupati: 12, prossimo_posto: null, fase: null },
  { categoria: "M", posti: 16, occupati: 11, prossimo_posto: 12, fase: null },
];

const AT = new Date("2027-06-01T10:00:00Z");

describe("toTappaDettaglio", () => {
  it("due tabelloni M e F con stato e posti, il proprio evidenziato", () => {
    const view = toTappaDettaglio(ROW, BOARDS, {
      categoria: "M",
      iscrizione: null,
      at: AT,
    });
    expect(
      view.tabelloni.map((t) => [t.label, t.postiTesto, t.statoTesto, t.tuo]),
    ).toEqual([
      ["Femminile", "0 liberi su 12", "Completo", false],
      ["Maschile", "5 liberi su 16", "Posti disponibili", true],
    ]);
    expect(view.azione).toBe("Prendi il posto 12 nel maschile");
    expect(view.motivo).toBeNull();
    expect(view.periodo).toBe("26–27 giugno");
  });

  it("tabellone pieno: esaurite, senza numero di posto", () => {
    const view = toTappaDettaglio(ROW, BOARDS, {
      categoria: "F",
      iscrizione: null,
      at: AT,
    });
    expect(view.motivo).toBe("esaurite");
    expect(view.azione).toBe("Prendi un posto nel femminile");
    expect(view.motivoTesto).toBe("Posti esauriti nella tua categoria.");
  });

  it("scadenza passata sull'orologio del server", () => {
    const view = toTappaDettaglio(ROW, BOARDS, {
      categoria: "M",
      iscrizione: null,
      at: new Date("2027-06-19T22:00:00Z"),
    });
    expect(view.motivo).toBe("scadute");
    expect(view.motivoTesto).toMatch(/scadute il 19 giugno/);
  });

  it("iscrizioni non ancora aperte: dice quando aprono", () => {
    const view = toTappaDettaglio(ROW, BOARDS, {
      categoria: "M",
      iscrizione: null,
      at: new Date("2027-05-01T10:00:00Z"),
    });
    expect(view.motivo).toBe("chiuse");
    expect(view.motivoTesto).toMatch(/aprono il 15 maggio/);
  });

  it("già iscritto", () => {
    const view = toTappaDettaglio(ROW, BOARDS, {
      categoria: "M",
      iscrizione: { id: "i1", posto: 4, stato: "in_attesa", categoria: "M" },
      at: AT,
    });
    expect(view.motivo).toBe("gia_iscritto");
  });

  it("in corso: fase del proprio tabellone", () => {
    const view = toTappaDettaglio(
      { ...ROW, stato: "in_corso" },
      [
        { ...BOARDS[0], fase: "eliminazione" },
        { ...BOARDS[1], fase: "gironi" },
      ],
      { categoria: "M", iscrizione: null, at: AT },
    );
    expect(view.fase).toBe("gironi");
    expect(view.tabelloni[0].statoTesto).toBe("In gioco");
    expect(view.motivo).toBe("chiuse");
  });
});

describe("toIscrizioneConfermata", () => {
  it("annulla entro: la scadenza dedicata o, se manca, quella delle iscrizioni", () => {
    const iscr = {
      id: "i1",
      posto: 12,
      stato: "in_attesa" as const,
      categoria: "M" as const,
    };
    expect(toIscrizioneConfermata(ROW, iscr, AT).annullaEntro).toMatch(
      /19 giugno/,
    );
    expect(
      toIscrizioneConfermata(
        { ...ROW, annullabile_fino_al: "2027-06-21T21:59:00Z" },
        iscr,
        AT,
      ).annullaEntro,
    ).toMatch(/21 giugno/);
    expect(toIscrizioneConfermata(ROW, iscr, AT)).toMatchObject({
      posto: 12,
      luogo: "Rimini, Bagno 26",
      ritrovo: "Bagno 26",
      periodo: "26–27 giugno",
    });
  });
});
