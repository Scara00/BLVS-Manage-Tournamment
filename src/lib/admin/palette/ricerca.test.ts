import { describe, expect, it } from "vitest";
import type { AdminTappa } from "@/lib/admin/tappe";
import { toRisultatoPartita, type PartitaTrovataRow } from "./partite";
import {
  annuncioRisultati,
  cercaComandi,
  cercaTappe,
  COMANDI_PALETTE,
  corrisponde,
  normalizza,
  opzioni,
  PALETTE_MAX_PER_GRUPPO,
  raggruppa,
  schedaGiocatoreHref,
} from "./ricerca";

function tappa(id: string, nome: string, stato: AdminTappa["stato"]) {
  return {
    id,
    nome,
    periodo: "14–15 giugno 2027",
    stato,
    motivoAnnullamento: null,
    categorie: [],
    partiteDaInserire: 0,
    giornoDiGara: false,
  } satisfies AdminTappa;
}

const tappe = [
  tappa("jesolo", "Tappa 1 · Jesolo", "in_corso"),
  tappa("rimini", "Tappa 2 · Rimini", "iscrizioni_aperte"),
  tappa("pescara", "Tappa 4 · Pescara", "bozza"),
];

describe("corrisponde", () => {
  it("ignora maiuscole e accenti", () => {
    expect(normalizza("Niccolò")).toBe("niccolo");
    expect(corrisponde(["NICCO"], ["Niccolò Senzacategoria"])).toBe(true);
  });

  it("ogni parola deve comparire, anche in testi diversi", () => {
    expect(corrisponde(["rossi", "luca"], ["Luca", "Rossi"])).toBe(true);
    expect(corrisponde(["rossi", "marco"], ["Luca", "Rossi"])).toBe(false);
  });
});

describe("cercaTappe", () => {
  it("trova per nome e porta alla gestione della tappa", () => {
    expect(cercaTappe(tappe, ["jes"])).toEqual([
      {
        tipo: "tappa",
        id: "jesolo",
        titolo: "Tappa 1 · Jesolo",
        dettaglio: "14–15 giugno 2027 · In corso",
        href: "/admin/tappe/jesolo",
      },
    ]);
  });

  it("trova anche per stato e rispetta il limite", () => {
    expect(cercaTappe(tappe, ["bozza"]).map((t) => t.id)).toEqual(["pescara"]);
    expect(cercaTappe(tappe, ["tappa"], 2)).toHaveLength(2);
    expect(cercaTappe(tappe, [])).toEqual([]);
  });
});

describe("comandi", () => {
  it("senza parole li propone tutti, con parole li filtra", () => {
    expect(cercaComandi([])).toEqual(COMANDI_PALETTE);
    expect(cercaComandi(["nuova"]).map((c) => c.href)).toEqual([
      "/admin/tappe/nuova",
    ]);
  });
});

describe("raggruppa", () => {
  it("tiene l'ordine tappe, giocatori, partite, comandi e salta i vuoti", () => {
    const gruppi = raggruppa({
      comando: cercaComandi(["dashboard"]),
      giocatore: [],
      tappa: cercaTappe(tappe, ["jesolo"]),
    });
    expect(gruppi.map((g) => g.etichetta)).toEqual(["Tappe", "Comandi"]);
    expect(opzioni(gruppi).map((r) => r.id)).toEqual(["jesolo", "dashboard"]);
  });

  it("annuncia il numero di risultati", () => {
    expect(annuncioRisultati(0)).toBe("Nessun risultato");
    expect(annuncioRisultati(1)).toBe("1 risultato");
    expect(annuncioRisultati(PALETTE_MAX_PER_GRUPPO)).toBe("5 risultati");
  });
});

describe("destinazioni", () => {
  it("un giocatore apre la sua scheda pubblica", () => {
    expect(schedaGiocatoreHref("u-1", "F")).toBe(
      "/classifica/giocatore/u-1?categoria=F",
    );
    expect(schedaGiocatoreHref("u-2", null)).toBe("/classifica/giocatore/u-2");
  });

  const partita: PartitaTrovataRow = {
    partita_id: "p-1",
    tappa_id: "jesolo",
    tappa_nome: "Tappa 1 · Jesolo",
    categoria: "M",
    fase: "gironi",
    girone_nome: "Girone A",
    turno: 2,
    stato: "conclusa",
    sets: [{ a: 21, b: 17 }],
    squadra_a: [
      { nome: "Luca", cognome: "Rossi" },
      { nome: "Marco", cognome: "Bianchi" },
    ],
    squadra_b: [
      { nome: "Paolo", cognome: "Verdi" },
      { nome: "Gino", cognome: "Neri" },
    ],
  };

  it("una partita dei gironi apre l'inserimento del punteggio", () => {
    expect(toRisultatoPartita(partita)).toEqual({
      tipo: "partita",
      id: "p-1",
      titolo: "Rossi e Bianchi contro Verdi e Neri",
      dettaglio:
        "Tappa 1 · Jesolo · Maschile · Girone A, turno 2 · Conclusa 21–17",
      href: "/admin/tappe/jesolo/punteggi/p-1",
    });
  });

  it("una finale apre la gestione live del tabellone", () => {
    const finale = toRisultatoPartita({
      ...partita,
      fase: "finale",
      girone_nome: null,
      stato: "programmata",
      sets: [],
      squadra_b: [],
    });
    expect(finale.href).toBe("/admin/tappe/jesolo/live/m");
    expect(finale.titolo).toBe("Rossi e Bianchi contro Da definire");
    expect(finale.dettaglio).toBe(
      "Tappa 1 · Jesolo · Maschile · Turno 2 · Da giocare",
    );
  });
});
