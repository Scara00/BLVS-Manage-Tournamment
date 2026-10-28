import { describe, expect, it } from "vitest";
import {
  conseguenzeAnnullamento,
  puoAnnullare,
  REGOLA_ANNULLAMENTO,
  scadenzaAnnullamento,
  testoNonAnnullabile,
  type TappaAnnullabile,
} from "./regola";

const TAPPA: TappaAnnullabile = {
  stato: "iscrizioni_aperte",
  data_inizio: "2027-06-26",
  iscrizioni_chiudono_il: "2027-06-19T21:59:00Z",
  annullabile_fino_al: "2027-06-21T21:59:00Z",
};

const attiva = { stato: "in_attesa" as const, inGirone: false };

describe("scadenzaAnnullamento", () => {
  it("usa la scadenza dedicata, poi quella delle iscrizioni", () => {
    expect(scadenzaAnnullamento(TAPPA)).toBe("2027-06-21T21:59:00.000Z");
    expect(scadenzaAnnullamento({ ...TAPPA, annullabile_fino_al: null })).toBe(
      "2027-06-19T21:59:00.000Z",
    );
  });

  it("senza scadenze vale l'inizio della tappa, mezzanotte a Roma (Q-09)", () => {
    expect(REGOLA_ANNULLAMENTO.ripiego).toBe("inizio_tappa");
    const senza = {
      ...TAPPA,
      annullabile_fino_al: null,
      iscrizioni_chiudono_il: null,
    };
    // Summer time: midnight in Rome is 22:00 UTC of the day before.
    expect(scadenzaAnnullamento(senza)).toBe("2027-06-25T22:00:00.000Z");
    expect(scadenzaAnnullamento({ ...senza, data_inizio: "2027-01-10" })).toBe(
      "2027-01-09T23:00:00.000Z",
    );
    expect(scadenzaAnnullamento(senza, { ripiego: "nessuno" })).toBeNull();
  });
});

describe("puoAnnullare: limite di scadenza (orario del server)", () => {
  const scadenza = new Date("2027-06-21T21:59:00Z").getTime();

  it("si annulla fino all'istante prima della scadenza", () => {
    expect(
      puoAnnullare({ ...attiva, tappa: TAPPA }, new Date(scadenza - 1)),
    ).toEqual({ possibile: true, scadenza: "2027-06-21T21:59:00.000Z" });
  });

  it("alla scadenza esatta e dopo non si annulla più", () => {
    for (const at of [scadenza, scadenza + 1, scadenza + 86_400_000]) {
      expect(
        puoAnnullare({ ...attiva, tappa: TAPPA }, new Date(at)),
      ).toMatchObject({ possibile: false, motivo: "scadenza_superata" });
    }
  });

  it("con la regola «nessuno» e nessuna scadenza non si annulla mai", () => {
    const senza = {
      ...TAPPA,
      annullabile_fino_al: null,
      iscrizioni_chiudono_il: null,
    };
    expect(
      puoAnnullare(
        { ...attiva, tappa: senza },
        new Date("2020-01-01T00:00:00Z"),
        { ripiego: "nessuno" },
      ),
    ).toMatchObject({ possibile: false, motivo: "scadenza_superata" });
  });

  it("rifiuta iscrizioni non attive, tappe annullate o iniziate e chi è in un girone", () => {
    const at = new Date("2027-06-01T10:00:00Z");
    expect(
      puoAnnullare({ stato: "ritirata", inGirone: false, tappa: TAPPA }, at),
    ).toMatchObject({ motivo: "non_attiva" });
    expect(
      puoAnnullare({ ...attiva, tappa: { ...TAPPA, stato: "annullata" } }, at),
    ).toMatchObject({ motivo: "tappa_annullata" });
    for (const stato of ["in_corso", "conclusa", "archiviata"] as const) {
      expect(
        puoAnnullare({ ...attiva, tappa: { ...TAPPA, stato } }, at),
      ).toMatchObject({ motivo: "tappa_iniziata" });
    }
    expect(
      puoAnnullare({ ...attiva, inGirone: true, tappa: TAPPA }, at),
    ).toMatchObject({ motivo: "in_girone" });
    expect(
      puoAnnullare(
        { ...attiva, tappa: { ...TAPPA, stato: "iscrizioni_chiuse" } },
        at,
      ),
    ).toMatchObject({ possibile: true });
  });
});

describe("testi", () => {
  it("spiega perché l'azione non c'è, con la scadenza in ora di Roma", () => {
    expect(
      testoNonAnnullabile("scadenza_superata", "2027-06-21T21:59:00Z"),
    ).toMatch(/scadenza era il 21 giugno.*23:59/);
    expect(testoNonAnnullabile("non_attiva", null)).toBeNull();
    expect(testoNonAnnullabile("in_girone", null)).toMatch(/girone/);
  });

  it("elenca le conseguenze: il posto torna libero", () => {
    const testi = conseguenzeAnnullamento({
      posto: 12,
      tabellone: "nel maschile",
    });
    expect(testi[0]).toBe(
      "Il posto 12 nel maschile torna libero per un altro giocatore.",
    );
    expect(testi).toHaveLength(3);
  });
});
