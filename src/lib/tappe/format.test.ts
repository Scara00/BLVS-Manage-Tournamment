import { describe, expect, it } from "vitest";
import { demoStages, demoTappeGiocatore } from "@/lib/demo/tournament";
import {
  demoTappaCard,
  descriviPosti,
  escludiBozze,
  faseTappa,
  formatPeriodoTappa,
  postiPerCategoria,
  tappaInCorso,
  toTappaCard,
  toTappeGiocatore,
  type PostiRow,
  type TappaGiocatoreRow,
} from "./format";

describe("formatPeriodoTappa", () => {
  it("unisce i giorni dello stesso mese", () => {
    expect(formatPeriodoTappa("2026-06-14", "2026-06-15")).toBe("14–15 giugno");
  });

  it("scrive entrambi i mesi a cavallo di due mesi", () => {
    expect(formatPeriodoTappa("2026-06-30", "2026-07-01")).toBe(
      "30 giugno – 1 luglio",
    );
  });

  it("aggiunge l'anno a cavallo di due anni", () => {
    expect(formatPeriodoTappa("2026-12-31", "2027-01-01")).toBe(
      "31 dicembre 2026 – 1 gennaio 2027",
    );
  });

  it("un solo giorno", () => {
    expect(formatPeriodoTappa("2026-07-12", "2026-07-12")).toBe("12 luglio");
  });
});

describe("toTappaCard", () => {
  it("mappa una riga di public.tappe", () => {
    expect(
      toTappaCard({
        id: "t1",
        nome: "Tappa 1 · Jesolo",
        luogo: "Jesolo Lido",
        data_inizio: "2026-06-14",
        data_fine: "2026-06-15",
        stato: "iscrizioni_aperte",
      }),
    ).toEqual({
      id: "t1",
      name: "Tappa 1 · Jesolo",
      place: "Jesolo Lido",
      date: "14–15 giugno",
      stato: "iscrizioni_aperte",
    });
  });

  it("converte lo stato delle tappe demo nell'enum del database", () => {
    expect(demoStages.map(demoTappaCard).map((t) => t.stato)).toEqual([
      "in_corso",
      "iscrizioni_aperte",
      "iscrizioni_chiuse",
    ]);
  });
});

const riga = (
  id: string,
  stato: TappaGiocatoreRow["stato"],
  iscrizioni_chiudono_il: string | null = "2026-06-21T21:59:00Z",
): TappaGiocatoreRow => ({
  id,
  nome: `Tappa ${id}`,
  luogo: "Spiaggia",
  data_inizio: "2026-06-28",
  data_fine: "2026-06-29",
  stato,
  iscrizioni_chiudono_il,
});

const posti = (
  tappa_id: string,
  categoria: "M" | "F",
  totali: number,
  occupati: number,
  fase: PostiRow["fase"] = null,
): PostiRow => ({ tappa_id, categoria, posti: totali, occupati, fase });

describe("escludiBozze", () => {
  it("toglie solo le tappe in bozza", () => {
    const rows = [
      riga("a", "bozza"),
      riga("b", "iscrizioni_aperte"),
      riga("c", "annullata"),
    ];
    expect(escludiBozze(rows).map((r) => r.id)).toEqual(["b", "c"]);
  });

  it("l'elenco del giocatore non mostra mai una bozza", () => {
    const tappe = toTappeGiocatore(
      [riga("a", "bozza"), riga("b", "iscrizioni_chiuse")],
      [posti("a", "M", 16, 0), posti("b", "M", 16, 0)],
      "M",
    );
    expect(tappe.map((t) => t.id)).toEqual(["b"]);
  });

  it("i dati demo contengono una bozza che resta fuori", () => {
    const { tappe, posti: demoPosti, categoria } = demoTappeGiocatore;
    expect(tappe.some((t) => t.stato === "bozza")).toBe(true);
    expect(
      toTappeGiocatore(tappe, demoPosti, categoria).some(
        (t) => t.stato === "bozza",
      ),
    ).toBe(false);
  });
});

describe("postiPerCategoria", () => {
  const righe = [posti("t1", "M", 16, 11), posti("t1", "F", 12, 12)];

  it("conta i posti liberi nella categoria del giocatore", () => {
    expect(postiPerCategoria(righe, "t1", "M")).toEqual({
      liberi: 5,
      totali: 16,
    });
    expect(postiPerCategoria(righe, "t1", "F")).toEqual({
      liberi: 0,
      totali: 12,
    });
  });

  it("non va mai sotto zero se gli iscritti superano i posti", () => {
    expect(postiPerCategoria([posti("t1", "M", 8, 10)], "t1", "M")).toEqual({
      liberi: 0,
      totali: 8,
    });
  });

  it("senza categoria o senza tabellone restituisce null", () => {
    expect(postiPerCategoria(righe, "t1", null)).toBeNull();
    expect(postiPerCategoria(righe, "altra", "M")).toBeNull();
  });

  it("descrive i posti come «N liberi su M»", () => {
    expect(descriviPosti({ liberi: 5, totali: 16 })).toBe("5 liberi su 16");
    expect(descriviPosti({ liberi: 1, totali: 16 })).toBe("1 libero su 16");
  });
});

describe("toTappeGiocatore", () => {
  it("si iscrive solo a una tappa aperta con posti liberi nella sua categoria", () => {
    const [aperta, piena] = toTappeGiocatore(
      [riga("a", "iscrizioni_aperte"), riga("b", "iscrizioni_aperte")],
      [posti("a", "M", 16, 3), posti("b", "M", 16, 16), posti("b", "F", 16, 0)],
      "M",
    );
    expect(aperta.iscrivibile).toBe(true);
    expect(piena.iscrivibile).toBe(false);
    expect(piena.posti).toEqual({ liberi: 0, totali: 16 });
  });

  it("una tappa annullata non ha posti né iscrizione", () => {
    const [annullata] = toTappeGiocatore(
      [riga("a", "annullata")],
      [posti("a", "M", 16, 0)],
      "M",
    );
    expect(annullata.stato).toBe("annullata");
    expect(annullata.posti).toBeNull();
    expect(annullata.iscrivibile).toBe(false);
  });

  it("senza categoria non mostra posti e non permette l'iscrizione", () => {
    const [tappa] = toTappeGiocatore(
      [riga("a", "iscrizioni_aperte")],
      [posti("a", "M", 16, 0)],
      null,
    );
    expect(tappa.posti).toBeNull();
    expect(tappa.iscrivibile).toBe(false);
  });

  it("formatta la scadenza in ora italiana", () => {
    const [tappa, senza] = toTappeGiocatore(
      [riga("a", "iscrizioni_aperte"), riga("b", "iscrizioni_aperte", null)],
      [],
      "M",
    );
    expect(tappa.scadenza).toBe("21 giugno alle ore 23:59");
    expect(tappa.scadenzaIso).toBe("2026-06-21T21:59:00Z");
    expect(senza.scadenza).toBeNull();
  });

  it("mostra la fase solo per la tappa in corso, quella della categoria", () => {
    const [inCorso, chiusa] = toTappeGiocatore(
      [riga("a", "in_corso"), riga("b", "iscrizioni_chiuse")],
      [
        posti("a", "M", 16, 16, "gironi"),
        posti("a", "F", 16, 16, "finale"),
        posti("b", "M", 16, 16, "gironi"),
      ],
      "M",
    );
    expect(inCorso.fase).toBe("gironi");
    expect(chiusa.fase).toBeNull();
    expect(tappaInCorso([chiusa, inCorso])?.id).toBe("a");
  });

  it("senza categoria la fase è la più avanzata dei due tabelloni", () => {
    expect(
      faseTappa(
        [
          posti("a", "M", 16, 0, "eliminazione"),
          posti("a", "F", 16, 0, "gironi"),
        ],
        "a",
        null,
      ),
    ).toBe("eliminazione");
  });
});
