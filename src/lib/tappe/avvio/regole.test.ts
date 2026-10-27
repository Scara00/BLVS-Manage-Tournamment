import { describe, expect, it } from "vitest";
import {
  assegnaLettere,
  avvioNonDisponibile,
  controllaAvvio,
  controlliView,
  messaggioProblema,
  partiteGirone,
  REGOLA_AVVIO,
  riepilogoAvvio,
  type GironeAvvio,
} from "./regole";

function girone(id: string, cognomi: string[], utenti = cognomi): GironeAvvio {
  return {
    id,
    nome: `Girone ${id.toUpperCase()}`,
    giocatori: cognomi.map((cognome, i) => ({
      iscrizioneId: `${id}-${i}`,
      utenteId: utenti[i],
      lettera: String.fromCharCode(65 + i),
      nome: "N",
      cognome,
    })),
  };
}

const A = girone("a", ["Rossi", "Bianchi", "Marino", "Greco"]);
const B = girone("b", ["Costa", "Conti", "Gallo", "Bruno"]);

describe("controllaAvvio: regole di blocco", () => {
  it("nessun problema con gironi da 4 e tutti assegnati", () => {
    expect(controllaAvvio({ gironi: [A, B], nonAssegnati: [] })).toEqual([]);
  });

  it("blocca un tabellone senza gironi", () => {
    expect(controllaAvvio({ gironi: [], nonAssegnati: [] })).toEqual([
      {
        regola: "nessun_girone",
        gironeId: null,
        gironeNome: null,
        dettaglio: null,
      },
    ]);
  });

  it("blocca ogni girone che non è da 4, con il numero di giocatori", () => {
    const tre = girone("c", ["Uno", "Due", "Tre"]);
    const cinque = girone("d", ["A", "B", "C", "D", "E"]);
    expect(
      controllaAvvio({ gironi: [A, tre, cinque], nonAssegnati: [] }),
    ).toEqual([
      {
        regola: "girone_non_da_4",
        gironeId: "c",
        gironeNome: "Girone C",
        dettaglio: "3",
      },
      {
        regola: "girone_non_da_4",
        gironeId: "d",
        gironeNome: "Girone D",
        dettaglio: "5",
      },
    ]);
  });

  it("blocca i doppioni in ogni girone che li contiene", () => {
    const doppio = girone(
      "b",
      ["Costa", "Conti", "Gallo", "Rossi"],
      ["Costa", "Conti", "Gallo", "Rossi"],
    );
    const problemi = controllaAvvio({ gironi: [A, doppio], nonAssegnati: [] });
    expect(problemi).toEqual([
      {
        regola: "doppione",
        gironeId: "a",
        gironeNome: "Girone A",
        dettaglio: "Rossi N",
      },
      {
        regola: "doppione",
        gironeId: "b",
        gironeNome: "Girone B",
        dettaglio: "Rossi N",
      },
    ]);
  });

  it("blocca gli iscritti non assegnati, in ordine di cognome", () => {
    const problemi = controllaAvvio({
      gironi: [A],
      nonAssegnati: [
        { iscrizioneId: "x", nome: "Sara", cognome: "Verdi" },
        { iscrizioneId: "y", nome: "Luca", cognome: "Neri" },
      ],
    });
    expect(problemi.map((p) => [p.regola, p.dettaglio])).toEqual([
      ["non_assegnato", "Neri Luca"],
      ["non_assegnato", "Verdi Sara"],
    ]);
  });

  it("eccezione Q-05: con ammettiResto meno di 4 esclusi non bloccano", () => {
    const regola = { ...REGOLA_AVVIO, ammettiResto: true };
    const fuori = (n: number) =>
      Array.from({ length: n }, (_, i) => ({
        iscrizioneId: `f${i}`,
        nome: "N",
        cognome: `F${i}`,
      }));
    expect(
      controllaAvvio({ gironi: [A], nonAssegnati: fuori(3) }, regola),
    ).toEqual([]);
    expect(
      controllaAvvio({ gironi: [A], nonAssegnati: fuori(4) }, regola),
    ).toHaveLength(4);
  });

  it("riassume i tre controlli", () => {
    const problemi = controllaAvvio({
      gironi: [girone("c", ["Uno", "Due", "Tre"])],
      nonAssegnati: [{ iscrizioneId: "x", nome: "Sara", cognome: "Verdi" }],
    });
    expect(controlliView(problemi)).toEqual([
      { chiave: "gironi", label: "Gironi da 4", ok: false, problemi: 1 },
      { chiave: "doppioni", label: "Nessun doppione", ok: true, problemi: 0 },
      {
        chiave: "assegnati",
        label: "Tutti gli iscritti assegnati",
        ok: false,
        problemi: 1,
      },
    ]);
  });

  it("descrive ogni errore", () => {
    const [tre, fuori] = controllaAvvio({
      gironi: [girone("c", ["Uno", "Due", "Tre"])],
      nonAssegnati: [{ iscrizioneId: "x", nome: "Sara", cognome: "Verdi" }],
    });
    expect(messaggioProblema(tre)).toBe(
      "Girone C: ha 3 giocatori invece di 4.",
    );
    expect(messaggioProblema(fuori)).toBe("Verdi Sara non è in nessun girone.");
  });
});

describe("partite da creare", () => {
  it("segue la rotazione King/Queen: AB-CD, AC-BD, AD-BC", () => {
    const cognomi = (p: { cognome: string }[]) => p.map((g) => g.cognome);
    expect(
      partiteGirone(A).map((p) => [
        p.turno,
        cognomi(p.squadraA),
        cognomi(p.squadraB),
      ]),
    ).toEqual([
      [1, ["Rossi", "Bianchi"], ["Marino", "Greco"]],
      [2, ["Rossi", "Marino"], ["Bianchi", "Greco"]],
      [3, ["Rossi", "Greco"], ["Bianchi", "Marino"]],
    ]);
  });

  it("ognuno fa coppia una volta con ciascuno degli altri", () => {
    const coppie = partiteGirone(A).flatMap((p) => [p.squadraA, p.squadraB]);
    const chiavi = coppie.map((c) =>
      c
        .map((g) => g.lettera)
        .sort()
        .join(""),
    );
    expect(new Set(chiavi).size).toBe(6);
  });

  it("nessuna partita per un girone incompleto", () => {
    expect(partiteGirone(girone("c", ["Uno", "Due", "Tre"]))).toEqual([]);
  });

  it("conta gironi, giocatori e partite", () => {
    expect(riepilogoAvvio({ gironi: [A, B] })).toEqual({
      gironi: 2,
      giocatori: 8,
      partite: 6,
    });
  });

  it("assegna le lettere per posto, poi cognome", () => {
    const lettere = assegnaLettere([
      { iscrizioneId: "1", nome: "N", cognome: "Zeta", posto: null },
      { iscrizioneId: "2", nome: "N", cognome: "Beta", posto: 7 },
      { iscrizioneId: "3", nome: "N", cognome: "Alfa", posto: 2 },
    ]);
    expect(lettere.map((g) => `${g.lettera}${g.cognome}`)).toEqual([
      "AAlfa",
      "BBeta",
      "CZeta",
    ]);
  });
});

describe("avvioNonDisponibile", () => {
  const tappa = { id: "t", nome: "T", stato: "iscrizioni_chiuse" as const };
  it("disponibile a iscrizioni chiuse o in corso", () => {
    expect(avvioNonDisponibile({ tappa, faseGioco: null })).toBeNull();
    expect(
      avvioNonDisponibile({
        tappa: { ...tappa, stato: "in_corso" },
        faseGioco: null,
      }),
    ).toBeNull();
  });
  it("non disponibile se già avviata o prima della chiusura", () => {
    expect(
      avvioNonDisponibile({ tappa, faseGioco: "gironi_iniziali" }),
    ).toMatch(/già avviata/);
    expect(
      avvioNonDisponibile({
        tappa: { ...tappa, stato: "iscrizioni_aperte" },
        faseGioco: null,
      }),
    ).toMatch(/chiusura delle iscrizioni/);
  });
});
