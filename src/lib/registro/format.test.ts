import { describe, expect, it } from "vitest";
import { righeStorie } from "@/components/admin-registro/stories-data";
import { TIPI_EVENTO_REGISTRO } from "@/lib/audit";
import {
  etichettaPartita,
  riepilogoValori,
  setsTesto,
  tipoVoce,
  toPagina,
  toVoceView,
} from "./format";

describe("tipoVoce", () => {
  it("solo Correzione e Parità risolta sono badge", () => {
    const badge = TIPI_EVENTO_REGISTRO.filter((t) => tipoVoce(t).badge);
    expect(badge).toEqual(["correzione_punteggio", "parita_risolta"]);
    expect(tipoVoce("correzione_punteggio").label).toBe("Correzione");
    expect(tipoVoce("inserimento_punteggio")).toMatchObject({
      label: "Inserimento",
      badge: false,
    });
  });
});

describe("riepilogoValori", () => {
  it("punteggi: prima → dopo", () => {
    expect(
      riepilogoValori(
        "correzione_punteggio",
        { sets: [{ a: 21, b: 18 }] },
        {
          sets: [
            { a: 21, b: 19 },
            { a: 15, b: 13 },
          ],
        },
      ),
    ).toEqual({ prima: "21–18", dopo: "21–19 · 15–13" });
    expect(
      riepilogoValori("inserimento_punteggio", null, [{ a: 21, b: 10 }]),
    ).toEqual({ prima: "—", dopo: "21–10" });
    expect(
      riepilogoValori(
        "annullamento_punteggio",
        { sets: [{ a: 21, b: 15 }] },
        null,
      ),
    ).toEqual({ prima: "21–15", dopo: "Annullato" });
    expect(setsTesto({ sets: [{ a: "x" }] })).toBe("—");
  });

  it("rigenerazione, parità, categoria, ritiro", () => {
    expect(
      riepilogoValori(
        "rigenerazione_gironi",
        { gironi: [{ nome: "A" }, { nome: "B" }], punteggi_persi: 1 },
        { gironi: 3, partite: 9, punteggi_persi: 1 },
      ),
    ).toEqual({
      prima: "2 gironi · 1 punteggio perso",
      dopo: "3 gironi · 9 partite",
    });
    expect(
      riepilogoValori("parita_risolta", null, { ordine: ["Anna", "Bruno"] }),
    ).toEqual({ prima: "—", dopo: "1. Anna, 2. Bruno" });
    expect(
      riepilogoValori(
        "cambio_categoria",
        { categoria: "M" },
        { categoria: "F" },
      ),
    ).toEqual({ prima: "Maschile", dopo: "Femminile" });
    expect(riepilogoValori("ritiro", null, null)).toEqual({
      prima: "—",
      dopo: "Ritirato",
    });
  });

  it("ritiro e assenza (BLVS-42): partite prima e dopo la regola", () => {
    const partite = (dopo: boolean) => [
      {
        partita_id: "p1",
        girone: "Girone A",
        turno: 1,
        sets: dopo ? [] : [{ a: 21, b: 18 }],
        stato: dopo ? "annullata" : "conclusa",
      },
      {
        partita_id: "p2",
        girone: "Girone A",
        turno: 2,
        sets: [],
        stato: dopo ? "annullata" : "programmata",
      },
    ];
    expect(
      riepilogoValori(
        "assenza",
        { giocatore: "Luca Rossi", partite: partite(false) },
        { giocatore: "Luca Rossi", partite: partite(true) },
      ),
    ).toEqual({
      prima: "Luca Rossi · Girone A t1 21–18, Girone A t2 da giocare",
      dopo: "Girone A t1 annullata, Girone A t2 annullata",
    });
    expect(
      riepilogoValori(
        "correzione_punteggio",
        { sets: [{ a: 21, b: 18 }], stato: "conclusa" },
        { sets: [], stato: "annullata" },
      ),
    ).toEqual({ prima: "21–18", dopo: "Partita annullata" });
  });
});

describe("toVoceView", () => {
  it("autore, ora di Roma e partita", () => {
    const [riga] = righeStorie(1);
    const voce = toVoceView(riga);
    expect(voce.autore).toBe("Paola Arbitri");
    expect(voce.giorno).toBe("2027-06-12");
    expect(voce.ora).toBe("11:42");
    expect(voce.partita?.etichetta).toBe(
      "Girone A · Turno 1 · M — Luca Rossi e Marco Bianchi contro Andrea Ferrari e Matteo Russo",
    );
    expect(toVoceView({ ...riga, autore: null }).autore).toBe("Utente rimosso");
    expect(toVoceView({ ...riga, partita: null }).partita?.etichetta).toBe(
      "Partita non più presente",
    );
  });

  it("le voci restanti vengono dal totale della pagina", () => {
    expect(toPagina(righeStorie(3, 7)).restanti).toBe(7);
    expect(toPagina([]).restanti).toBe(0);
  });

  it("etichetta delle partite a eliminazione", () => {
    expect(
      etichettaPartita({
        categoria: "F",
        fase: "finale",
        girone: null,
        turno: 1,
        squadra_a: [],
        squadra_b: ["Sara"],
      }),
    ).toBe("Finale · Turno 1 · F — ? contro Sara");
  });
});
