import { describe, expect, it } from "vitest";
import {
  DEMO_ANONIMI,
  demoUtente,
  getDemoDatiClassifica,
} from "@/lib/demo/classifica-generale";
import type { LiveEvent, OverallPlayerRow } from "@/lib/live/types";
import {
  classificaDaDati,
  classificaTappaDaDati,
  DATI_VUOTI,
  toOverallStandings,
  type DatiClassificaGenerale,
} from "./dati";
import {
  annuncioScheda,
  dataTappaLabel,
  faseTappaTesto,
  NOME_ANONIMO,
  nomeGiocatore,
  rigaGiocatore,
  tappeGiocatore,
} from "./giocatore";
import { giocatoreHref } from "./paths";

const standings2026 = () =>
  toOverallStandings(
    classificaDaDati(getDemoDatiClassifica("M", 2026), "M", 2026),
  );

describe("dati della scheda", () => {
  it("ogni tappa con fase, posizione, punti e stato provvisorio", () => {
    // 2026 M, player 1: Jesolo 1st gold, Rimini 2nd gold, Cagliari (open) 1st gold.
    const row = rigaGiocatore(standings2026(), demoUtente("M", 1))!;
    expect(row.results).toHaveLength(3);
    const [cagliari, rimini, jesolo] = tappeGiocatore(row);
    expect(jesolo).toMatchObject({
      stageId: "demo-cg-jesolo",
      phase: "gold",
      position: 1,
      points: 12,
      provisional: false,
      definitive: true,
    });
    expect(rimini).toMatchObject({ phase: "gold", position: 2, points: 8 });
    expect(cagliari).toMatchObject({
      stageId: "demo-cg-cagliari",
      provisional: true,
      definitive: false,
    });
    expect(row.points).toBe(
      row.results!.reduce((somma, t) => somma + t.points, 0),
    );
  });

  it("silver e fuori dalle finali", () => {
    const standings = standings2026();
    const silver = rigaGiocatore(standings, demoUtente("M", 5))!;
    expect(tappeGiocatore(silver).map((t) => t.phase)).toContain("silver");
    const fuori = rigaGiocatore(standings, demoUtente("M", 12))!;
    expect(
      tappeGiocatore(fuori).every(
        (t) => t.phase === null && t.position === null && t.points === 0,
      ),
    ).toBe(true);
  });

  it("le tappe vanno dalla più recente", () => {
    const row = {
      results: [
        { stageId: "a", date: "2026-05-01" },
        { stageId: "c", date: "2026-07-01" },
        { stageId: "b", date: "2026-06-01" },
      ],
    } as unknown as OverallPlayerRow;
    expect(tappeGiocatore(row).map((t) => t.stageId)).toEqual(["c", "b", "a"]);
  });

  it("un giocatore sconosciuto non ha scheda", () => {
    expect(rigaGiocatore(standings2026(), "nessuno")).toBeUndefined();
    expect(
      rigaGiocatore(
        toOverallStandings(classificaDaDati(DATI_VUOTI, "M", 2026)),
        demoUtente("M", 1),
      ),
    ).toBeUndefined();
  });
});

describe("anonimizzazione", () => {
  const anonimo = [...DEMO_ANONIMI][0];

  it("un account cancellato è «Giocatore anonimo», con i suoi risultati", () => {
    const row = rigaGiocatore(standings2026(), anonimo)!;
    expect(row).toMatchObject({ name: NOME_ANONIMO, anonymous: true });
    expect(row.results).toHaveLength(3);
    expect(row.points).toBeGreaterThan(0);
  });

  it("nessun dato personale, anche se la RPC mandasse ancora un nome", () => {
    const dati = getDemoDatiClassifica("M", 2026);
    const conNome: DatiClassificaGenerale = {
      ...dati,
      iscrizioni: dati.iscrizioni.map((i) =>
        i.anonimo ? { ...i, nome: "Alessandro", cognome: "Greco" } : i,
      ),
    };
    const standings = toOverallStandings(classificaDaDati(conNome, "M", 2026));
    const row = rigaGiocatore(standings, anonimo)!;
    expect(JSON.stringify(row)).not.toMatch(/Alessandro|Greco/);
    expect(row.name).toBe(NOME_ANONIMO);

    const { classifica } = classificaTappaDaDati(conNome, "demo-cg-jesolo");
    expect(JSON.stringify(classifica)).not.toMatch(/Alessandro|Greco/);
    expect(classifica.righe.map((r) => r.nome)).toContain(NOME_ANONIMO);
  });

  it("il nome mostrato non dipende dal campo name per un account cancellato", () => {
    expect(nomeGiocatore({ name: "Luca Rossi", anonymous: true })).toBe(
      NOME_ANONIMO,
    );
    expect(nomeGiocatore({ name: "Luca Rossi" })).toBe("Luca Rossi");
  });
});

describe("testi", () => {
  it("fase sempre a testo, ★/◆ accanto alla parola", () => {
    expect(faseTappaTesto("gold")).toEqual({
      simbolo: "★",
      testo: "Finale gold",
    });
    expect(faseTappaTesto("silver")).toEqual({
      simbolo: "◆",
      testo: "Finale silver",
    });
    expect(faseTappaTesto(null)).toEqual({
      simbolo: null,
      testo: "Non in finale",
    });
  });

  it("data della tappa in italiano, senza fuso orario", () => {
    expect(dataTappaLabel("2026-05-16")).toBe("16 maggio 2026");
    expect(dataTappaLabel("2026-12-01")).toBe("1 dicembre 2026");
  });

  it("link alla scheda con categoria e stagione", () => {
    expect(giocatoreHref("demo-u-m-01", "M", 2026)).toBe(
      "/classifica/giocatore/demo-u-m-01?categoria=M&stagione=2026",
    );
    expect(giocatoreHref("a/b", "F", null)).toBe(
      "/classifica/giocatore/a%2Fb?categoria=F",
    );
  });

  it("annuncio: solo questo giocatore, punti provvisori a testo", () => {
    const standings = { ...standings2026(), change: "Tappa 3: punti salvati" };
    const event: LiveEvent = {
      seq: 1,
      savedAt: "2026-07-18T08:00:00.000Z",
      type: "overall-standings",
      rows: [],
      standings,
    };
    const row = rigaGiocatore(standings, demoUtente("M", 1))!;
    expect(annuncioScheda(event, demoUtente("M", 1))).toBe(
      `Scheda aggiornata: Tappa 3: punti salvati: Luca Rossi ${row.position}ª, ${row.points} punti provvisori`,
    );
  });
});
