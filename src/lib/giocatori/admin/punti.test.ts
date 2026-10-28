import { describe, expect, it } from "vitest";
import {
  classificaDaDati,
  type DatiClassificaGenerale,
  type DatiTabellone,
} from "@/lib/classifica-generale/dati";
import type { Categoria } from "@/lib/db/types";
import {
  conCategoria,
  datiDellaStagione,
  datiDellAltra,
  puntiPerStagione,
  spostamentoPunti,
  stagioniGiocate,
} from "./punti";

/**
 * One stage per board with a gold final of 4 (no silver): the three
 * King/Queen matches AB–CD, AC–BD, AD–BC all won by the first team, so the
 * finishing order is the listed one (12, 8, 4, 2 points).
 */
function tabellone(
  categoria: Categoria,
  tappe: { id: string; stagione: number; giocatori: string[] }[],
  categorie: Record<string, Categoria> = {},
): DatiTabellone {
  const dati: { [K in keyof DatiTabellone]: DatiTabellone[K][number][] } = {
    tappe: [],
    gironi: [],
    membri: [],
    partite: [],
    decisioni: [],
    iscrizioni: [],
  };
  for (const t of tappe) {
    const girone = `${t.id}-${categoria}-gold`;
    const iscr = (u: string) => `${t.id}-${u}`;
    dati.tappe.push({
      id: t.id,
      nome: `Tappa ${t.id}`,
      data_inizio: `${t.stagione}-06-0${dati.tappe.length + 1}`,
      stagione: t.stagione,
      concluso: true,
    });
    dati.gironi.push({ id: girone, tappa_id: t.id, fase: "finale_gold" });
    for (const u of t.giocatori) {
      dati.membri.push({ girone_id: girone, iscrizione_id: iscr(u) });
      dati.iscrizioni.push({
        id: iscr(u),
        tappa_id: t.id,
        utente_id: u,
        nome: u,
        cognome: "",
        stato: "confermata",
        categoria_attuale: categorie[u] ?? categoria,
      });
    }
    const [a, b, c, d] = t.giocatori;
    (
      [
        [
          [a, b],
          [c, d],
        ],
        [
          [a, c],
          [b, d],
        ],
        [
          [a, d],
          [b, c],
        ],
      ] as const
    ).forEach(([x, y], n) => {
      dati.partite.push({
        id: `${girone}-t${n}`,
        girone_id: girone,
        stato: "conclusa",
        punteggi: { sets: [{ a: 21, b: 10 + n }] },
        partita_giocatori: [
          ...x.map((u) => ({ iscrizione_id: iscr(u), squadra: "A" as const })),
          ...y.map((u) => ({ iscrizione_id: iscr(u), squadra: "B" as const })),
        ],
      });
    });
  }
  return dati;
}

/** M: Luca wins two stages (2026, 2025). F: Giulia, Sara, … */
function datiM(
  categorie: Record<string, Categoria> = {},
): DatiClassificaGenerale {
  return {
    ...tabellone(
      "M",
      [
        {
          id: "m26",
          stagione: 2026,
          giocatori: ["luca", "marco", "andrea", "matteo"],
        },
        {
          id: "m25",
          stagione: 2025,
          giocatori: ["marco", "luca", "andrea", "matteo"],
        },
      ],
      categorie,
    ),
    altro: tabellone(
      "F",
      [
        {
          id: "m26",
          stagione: 2026,
          giocatori: ["giulia", "sara", "chiara", "elena"],
        },
      ],
      categorie,
    ),
  };
}

const riga = (d: DatiClassificaGenerale, c: Categoria, u: string, s: number) =>
  classificaDaDati(datiDellaStagione(d, s), c, s).righe.find(
    (r) => r.utenteId === u,
  );

describe("classifica generale: i punti seguono la categoria attuale", () => {
  it("senza cambi ognuno resta nella classifica del suo tabellone", () => {
    const d = datiM();
    expect(riga(d, "M", "luca", 2026)?.punti).toBe(12);
    expect(riga(datiDellAltra(d), "F", "luca", 2026)).toBeUndefined();
    expect(riga(datiDellAltra(d), "F", "giulia", 2026)?.posizione).toBe(1);
  });

  it("dopo il cambio i punti giocati nel maschile contano nel femminile", () => {
    const d = datiM({ luca: "F" });
    expect(riga(d, "M", "luca", 2026)).toBeUndefined();
    const f = riga(datiDellAltra(d), "F", "luca", 2026);
    expect(f?.punti).toBe(12);
    // Tie on 12 with Giulia: both 1 first place, Luca's most recent stage
    // is the same one, both one stage → shared first place.
    expect(f?.posizione).toBe(1);
    // Marco takes Luca's first place in the men's standing.
    expect(riga(d, "M", "marco", 2026)?.posizione).toBe(1);
  });

  it("la classifica di tappa resta sul tabellone giocato", () => {
    const d = datiM({ luca: "F" });
    // The men's board still lists Luca's stage result (stage standing).
    expect(d.iscrizioni.some((i) => i.utente_id === "luca")).toBe(true);
  });
});

describe("spostamentoPunti", () => {
  it("elenca per stagione i punti, la posizione prima e quella dopo", () => {
    expect(spostamentoPunti(datiM(), "luca", "M", "F")).toEqual([
      {
        stagione: 2026,
        punti: 12,
        tappe: 1,
        provvisori: false,
        posizionePrima: 1,
        posizioneDopo: 1,
      },
      {
        stagione: 2025,
        punti: 8,
        tappe: 1,
        provvisori: false,
        posizionePrima: 2,
        posizioneDopo: 1,
      },
    ]);
  });

  it("riporta indietro i punti di chi era già passato di categoria", () => {
    // Giulia played in F, now plays in M: her F points are in the M standing.
    const d = datiM({ giulia: "M" });
    expect(riga(d, "M", "giulia", 2026)?.punti).toBe(12);
    const ritorno = spostamentoPunti(d, "giulia", "M", "F");
    expect(ritorno).toHaveLength(1);
    expect(ritorno[0]).toMatchObject({ stagione: 2026, punti: 12 });
    expect(ritorno[0].posizioneDopo).toBe(1);
  });

  it("nessuno spostamento senza tappe giocate o per la stessa categoria", () => {
    expect(spostamentoPunti(datiM(), "nessuno", "M", "F")).toEqual([]);
    expect(spostamentoPunti(datiM(), "luca", "M", "M")).toEqual([]);
  });

  it("i punti provvisori restano segnalati", () => {
    const d = datiM();
    const aperto: DatiClassificaGenerale = {
      ...d,
      tappe: d.tappe.map((t) => ({ ...t, concluso: t.id !== "m26" })),
    };
    expect(spostamentoPunti(aperto, "luca", "M", "F")[0].provvisori).toBe(true);
  });
});

describe("helpers", () => {
  it("stagioniGiocate guarda entrambi i tabelloni, dalla più recente", () => {
    expect(stagioniGiocate(datiM(), "luca")).toEqual([2026, 2025]);
    expect(stagioniGiocate(datiM(), "giulia")).toEqual([2026]);
  });

  it("conCategoria cambia solo il giocatore indicato", () => {
    const d = conCategoria(datiM(), "luca", "F");
    expect(
      d.iscrizioni
        .filter((i) => i.categoria_attuale === "F")
        .map((i) => i.utente_id),
    ).toEqual(["luca", "luca"]);
  });

  it("puntiPerStagione riassume la riga del giocatore", () => {
    expect(puntiPerStagione(datiM(), "luca", "M")).toEqual([
      {
        stagione: 2026,
        categoria: "M",
        posizione: 1,
        punti: 12,
        tappe: 1,
        provvisori: false,
      },
      {
        stagione: 2025,
        categoria: "M",
        posizione: 2,
        punti: 8,
        tappe: 1,
        provvisori: false,
      },
    ]);
  });
});
