import { describe, expect, test } from "vitest";
import {
  giornoDiGara,
  posizioneNelGirone,
  saluto,
  scegliVista,
  statoIscrizioneHome,
  type IscrizioneHome,
  type TappaHomeRow,
} from "./vista";

const tappa = (over: Partial<TappaHomeRow> & { id: string }): TappaHomeRow => ({
  stato: "iscrizioni_aperte",
  data_inizio: "2027-06-14",
  data_fine: "2027-06-15",
  ...over,
});

const iscritto = (
  tappaId: string,
  stato: IscrizioneHome["stato"] = "confermata",
): IscrizioneHome => ({ tappaId, stato, posto: 3 });

const jesolo = tappa({ id: "jesolo", stato: "in_corso" });
const rimini = tappa({
  id: "rimini",
  data_inizio: "2027-06-28",
  data_fine: "2027-06-29",
});
const cagliari = tappa({
  id: "cagliari",
  stato: "iscrizioni_chiuse",
  data_inizio: "2027-07-12",
  data_fine: "2027-07-13",
});
const tappe = [cagliari, rimini, jesolo];

describe("giornoDiGara", () => {
  test("vale dal primo all'ultimo giorno di una tappa in corso", () => {
    expect(giornoDiGara(jesolo, "2027-06-13")).toBe(false);
    expect(giornoDiGara(jesolo, "2027-06-14")).toBe(true);
    expect(giornoDiGara(jesolo, "2027-06-15")).toBe(true);
    expect(giornoDiGara(jesolo, "2027-06-16")).toBe(false);
  });

  test("non vale se la tappa non è in corso, anche nelle sue date", () => {
    expect(
      giornoDiGara({ ...jesolo, stato: "iscrizioni_chiuse" }, "2027-06-14"),
    ).toBe(false);
    expect(giornoDiGara({ ...jesolo, stato: "conclusa" }, "2027-06-15")).toBe(
      false,
    );
  });
});

describe("scegliVista", () => {
  test("il giorno di gara di una mia tappa mostra la gara", () => {
    for (const oggi of ["2027-06-14", "2027-06-15"]) {
      expect(
        scegliVista({ tappe, iscrizioni: [iscritto("jesolo")], oggi }),
      ).toEqual({
        tipo: "gara",
        tappaId: "jesolo",
        iscrizione: iscritto("jesolo"),
      });
    }
  });

  test("anche con l'iscrizione in attesa", () => {
    expect(
      scegliVista({
        tappe,
        iscrizioni: [iscritto("jesolo", "in_attesa")],
        oggi: "2027-06-14",
      }).tipo,
    ).toBe("gara");
  });

  test("il giorno prima della gara mostra la prossima tappa, la mia", () => {
    expect(
      scegliVista({
        tappe,
        iscrizioni: [iscritto("jesolo")],
        oggi: "2027-06-13",
      }),
    ).toEqual({
      tipo: "prossima",
      tappaId: "jesolo",
      iscrizione: iscritto("jesolo"),
    });
  });

  test("il giorno dopo la gara passa alla tappa successiva", () => {
    expect(
      scegliVista({
        tappe,
        iscrizioni: [iscritto("jesolo"), iscritto("cagliari")],
        oggi: "2027-06-16",
      }),
    ).toEqual({
      tipo: "prossima",
      tappaId: "cagliari",
      iscrizione: iscritto("cagliari"),
    });
  });

  test("una tappa in corso a cui non sono iscritto non è il mio giorno di gara", () => {
    expect(scegliVista({ tappe, iscrizioni: [], oggi: "2027-06-14" })).toEqual({
      tipo: "prossima",
      tappaId: "jesolo",
      iscrizione: null,
    });
  });

  test("una tappa in corso fuori dalle sue date non è giorno di gara", () => {
    expect(
      scegliVista({
        tappe: [
          { ...jesolo, data_inizio: "2027-06-20", data_fine: "2027-06-21" },
        ],
        iscrizioni: [iscritto("jesolo")],
        oggi: "2027-06-14",
      }).tipo,
    ).toBe("prossima");
  });

  test("preferisce la prossima tappa a cui sono iscritto", () => {
    expect(
      scegliVista({
        tappe,
        iscrizioni: [iscritto("cagliari")],
        oggi: "2027-06-01",
      }),
    ).toMatchObject({ tipo: "prossima", tappaId: "cagliari" });
  });

  test("senza iscrizioni mostra la prima tappa in calendario", () => {
    expect(scegliVista({ tappe, iscrizioni: [], oggi: "2027-06-01" })).toEqual({
      tipo: "prossima",
      tappaId: "jesolo",
      iscrizione: null,
    });
  });

  test("un'iscrizione ritirata o rifiutata non conta", () => {
    expect(
      scegliVista({
        tappe,
        iscrizioni: [
          iscritto("jesolo", "ritirata"),
          iscritto("rimini", "rifiutata"),
        ],
        oggi: "2027-06-14",
      }),
    ).toEqual({ tipo: "prossima", tappaId: "jesolo", iscrizione: null });
  });

  test("bozze, tappe annullate e concluse non sono mai la prossima", () => {
    expect(
      scegliVista({
        tappe: [
          tappa({ id: "b", stato: "bozza" }),
          tappa({ id: "a", stato: "annullata" }),
          tappa({ id: "c", stato: "conclusa" }),
          tappa({ id: "x", stato: "archiviata" }),
        ],
        iscrizioni: [iscritto("a"), iscritto("c")],
        oggi: "2027-06-01",
      }),
    ).toEqual({ tipo: "vuota" });
  });

  test("dopo l'ultima tappa la home è vuota", () => {
    expect(
      scegliVista({
        tappe,
        iscrizioni: [iscritto("jesolo")],
        oggi: "2027-08-01",
      }),
    ).toEqual({ tipo: "vuota" });
  });

  test("senza tappe la home è vuota", () => {
    expect(
      scegliVista({ tappe: [], iscrizioni: [], oggi: "2027-06-01" }),
    ).toEqual({
      tipo: "vuota",
    });
  });
});

describe("saluto", () => {
  test("usa il nome, se c'è", () => {
    expect(saluto("Luca")).toBe("Ciao, Luca");
    expect(saluto("  ")).toBe("Ciao");
    expect(saluto(null)).toBe("Ciao");
  });
});

describe("statoIscrizioneHome", () => {
  test("dice a testo se sono iscritto e con quale posto", () => {
    expect(
      statoIscrizioneHome(iscritto("rimini"), {
        stato: "iscrizioni_aperte",
        iscrivibile: true,
      }),
    ).toEqual({ tipo: "iscritto", testo: "Sei iscritto · posto 3" });
    expect(
      statoIscrizioneHome(iscritto("rimini", "in_attesa"), {
        stato: "iscrizioni_aperte",
        iscrivibile: true,
      }).testo,
    ).toBe("Iscrizione in attesa di conferma · posto 3");
  });

  test("senza iscrizione: aperte, esaurite o chiuse", () => {
    expect(
      statoIscrizioneHome(null, {
        stato: "iscrizioni_aperte",
        iscrivibile: true,
      }).tipo,
    ).toBe("aperte");
    expect(
      statoIscrizioneHome(null, {
        stato: "iscrizioni_aperte",
        iscrivibile: false,
      }).testo,
    ).toBe("Posti esauriti nella tua categoria");
    expect(
      statoIscrizioneHome(null, {
        stato: "iscrizioni_chiuse",
        iscrivibile: false,
      }).testo,
    ).toBe("Iscrizioni chiuse");
  });
});

describe("posizioneNelGirone", () => {
  const rows = [
    { playerId: "a", position: 1 },
    { playerId: "b", position: 1 },
    { playerId: "c", position: 3 },
  ];
  test("dà la mia posizione e se è a pari merito", () => {
    expect(posizioneNelGirone(rows, "b")).toEqual({ position: 1, tied: true });
    expect(posizioneNelGirone(rows, "c")).toEqual({ position: 3, tied: false });
  });
  test("null se non sono nel girone", () => {
    expect(posizioneNelGirone(rows, "z")).toBeNull();
    expect(posizioneNelGirone(rows, null)).toBeNull();
  });
});
