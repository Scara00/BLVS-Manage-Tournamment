import { describe, expect, it } from "vitest";
import { STATI_TAPPA } from "@/lib/db/types";
import {
  confrontoOraDopo,
  formatIstante,
  fromRomeLocalInput,
  giorniAllaChiusura,
  isTransizionePermessa,
  prossimoStato,
  requisitoApertura,
  tipoTransizione,
  toRomeLocalInput,
  validaScadenza,
} from "./stato";

describe("transizioni permesse", () => {
  const permesse = new Set([
    "bozza>iscrizioni_aperte",
    "iscrizioni_aperte>iscrizioni_chiuse",
  ]);

  it.each(STATI_TAPPA.flatMap((da) => STATI_TAPPA.map((a) => [da, a])))(
    "%s → %s",
    (da, a) => {
      expect(isTransizionePermessa(da, a)).toBe(permesse.has(`${da}>${a}`));
    },
  );

  it("il prossimo passo è uno solo, in avanti", () => {
    expect(prossimoStato("bozza")).toBe("iscrizioni_aperte");
    expect(prossimoStato("iscrizioni_aperte")).toBe("iscrizioni_chiuse");
    expect(prossimoStato("iscrizioni_chiuse")).toBeNull();
    expect(prossimoStato("in_corso")).toBeNull();
  });

  it("dà un nome alle due transizioni", () => {
    expect(tipoTransizione("bozza", "iscrizioni_aperte")).toBe("apertura");
    expect(tipoTransizione("iscrizioni_aperte", "iscrizioni_chiuse")).toBe(
      "chiusura",
    );
    expect(tipoTransizione("bozza", "iscrizioni_chiuse")).toBeNull();
  });
});

describe("ora di Roma", () => {
  it("converte l'ora italiana in istante, estate e inverno", () => {
    expect(fromRomeLocalInput("2027-06-19T23:59")?.toISOString()).toBe(
      "2027-06-19T21:59:00.000Z",
    );
    expect(fromRomeLocalInput("2027-01-10T09:00")?.toISOString()).toBe(
      "2027-01-10T08:00:00.000Z",
    );
  });

  it("rifiuta date inesistenti o malformate", () => {
    expect(fromRomeLocalInput("2027-02-30T10:00")).toBeNull();
    expect(fromRomeLocalInput("2027-06-19 23:59")).toBeNull();
    expect(fromRomeLocalInput("")).toBeNull();
  });

  it("andata e ritorno con il valore del campo", () => {
    const date = new Date("2027-03-28T00:30:00Z"); // giorno del cambio d'ora
    expect(toRomeLocalInput(date)).toBe("2027-03-28T01:30");
    expect(fromRomeLocalInput(toRomeLocalInput(date))?.getTime()).toBe(
      date.getTime(),
    );
  });

  it("scrive data e ora in italiano", () => {
    expect(formatIstante(new Date("2027-06-19T21:59:00Z"))).toBe(
      "19 giugno 2027 alle 23:59",
    );
  });
});

describe("giorni alla chiusura", () => {
  const chiusura = new Date("2027-06-19T21:59:00Z"); // 19 giugno, 23:59

  it("conta i giorni di calendario di Roma", () => {
    expect(giorniAllaChiusura(chiusura, new Date("2027-06-16T10:00:00Z"))).toBe(
      3,
    );
    expect(giorniAllaChiusura(chiusura, new Date("2027-06-19T05:00:00Z"))).toBe(
      0,
    );
  });

  it("dopo la mezzanotte italiana (ancora il giorno prima in UTC) cambia giorno", () => {
    // 18 giugno 22:30 UTC = 19 giugno 00:30 a Roma.
    expect(giorniAllaChiusura(chiusura, new Date("2027-06-18T22:30:00Z"))).toBe(
      0,
    );
  });
});

describe("requisiti per aprire le iscrizioni", () => {
  const at = new Date("2027-05-01T10:00:00Z");

  it("serve una scadenza futura", () => {
    expect(requisitoApertura(null, at)).toMatch(/Imposta prima la scadenza/);
    expect(requisitoApertura(new Date("2027-04-30T10:00:00Z"), at)).toMatch(
      /già passata/,
    );
    expect(requisitoApertura(new Date("2027-06-01T10:00:00Z"), at)).toBeNull();
  });
});

describe("validaScadenza", () => {
  const at = new Date("2027-05-01T10:00:00Z");
  const vincoli = { dataInizio: "2027-06-26", iscrizioniApronoIl: null };

  it("accetta una scadenza futura prima della tappa", () => {
    const esito = validaScadenza("2027-06-19T23:59", vincoli, at);
    expect(esito).toEqual({
      ok: true,
      value: new Date("2027-06-19T21:59:00Z"),
    });
  });

  it.each([
    ["", /Inserisci/],
    ["domani", /non valida/],
    ["2027-04-30T10:00", /nel futuro/],
    ["2027-06-26T09:00", /entro l'inizio della tappa/],
  ])("rifiuta %j", (value, error) => {
    const esito = validaScadenza(value, vincoli, at);
    expect(esito.ok).toBe(false);
    if (!esito.ok) expect(esito.error).toMatch(error);
  });

  it("deve venire dopo l'apertura delle iscrizioni", () => {
    const esito = validaScadenza(
      "2027-05-10T12:00",
      { ...vincoli, iscrizioniApronoIl: new Date("2027-05-15T07:00:00Z") },
      at,
    );
    expect(esito.ok).toBe(false);
  });
});

describe("confronto Ora → Dopo", () => {
  const chiudono = new Date("2027-06-19T21:59:00Z");

  it("apertura: la tappa diventa visibile e accetta iscrizioni", () => {
    expect(confrontoOraDopo("bozza", "iscrizioni_aperte", chiudono)).toEqual([
      { aspetto: "Stato", ora: "Bozza", dopo: "Iscrizioni aperte" },
      { aspetto: "Visibile ai giocatori", ora: "No, è una bozza", dopo: "Sì" },
      {
        aspetto: "Nuove iscrizioni",
        ora: "Non accettate",
        dopo: "Accettate fino al 19 giugno 2027 alle 23:59",
      },
      {
        aspetto: "Chiusura",
        ora: "Prevista il 19 giugno 2027 alle 23:59, dopo l'apertura",
        dopo: "Automatica il 19 giugno 2027 alle 23:59",
      },
    ]);
  });

  it("chiusura: niente più iscrizioni", () => {
    const righe = confrontoOraDopo(
      "iscrizioni_aperte",
      "iscrizioni_chiuse",
      chiudono,
    );
    expect(righe.find((r) => r.aspetto === "Nuove iscrizioni")?.dopo).toBe(
      "Non accettate",
    );
    expect(righe.find((r) => r.aspetto === "Visibile ai giocatori")).toEqual({
      aspetto: "Visibile ai giocatori",
      ora: "Sì",
      dopo: "Sì",
    });
  });
});
