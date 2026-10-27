import { describe, expect, it } from "vitest";
import {
  applicaFiltri,
  descriviFiltri,
  filtriAttivi,
  filtriQuery,
  NESSUN_FILTRO,
  parseFiltri,
} from "./filtri";
import { registroPath } from "./paths";

const PARTITA = "0d1f0c4e-5a0b-4c1e-9a10-000000000001";

describe("parseFiltri", () => {
  it("legge tipo e partita dalla query", () => {
    expect(
      parseFiltri({ tipo: "correzione_punteggio", partita: PARTITA }),
    ).toEqual({ tipo: "correzione_punteggio", partita: PARTITA });
    expect(
      parseFiltri(new URLSearchParams(`tipo=ritiro&partita=${PARTITA}`)),
    ).toEqual({ tipo: "ritiro", partita: PARTITA });
  });

  it("scarta valori sconosciuti e prende il primo di una lista", () => {
    expect(parseFiltri({ tipo: "cancella_tutto", partita: "1; drop" })).toEqual(
      NESSUN_FILTRO,
    );
    expect(parseFiltri({ tipo: ["ritiro", "assenza"] }).tipo).toBe("ritiro");
    expect(parseFiltri(undefined)).toEqual(NESSUN_FILTRO);
  });

  it("andata e ritorno nella query e nel percorso", () => {
    const filtri = { tipo: "parita_risolta" as const, partita: PARTITA };
    expect(parseFiltri(new URLSearchParams(filtriQuery(filtri)))).toEqual(
      filtri,
    );
    expect(registroPath("jesolo", filtri)).toBe(
      `/admin/tappe/jesolo/registro?tipo=parita_risolta&partita=${PARTITA}`,
    );
    expect(registroPath("jesolo", NESSUN_FILTRO)).toBe(
      "/admin/tappe/jesolo/registro",
    );
    expect(filtriAttivi(NESSUN_FILTRO)).toBe(false);
    expect(filtriAttivi(filtri)).toBe(true);
  });
});

describe("applicaFiltri", () => {
  const voci = [
    { id: 1, tipo: "inserimento_punteggio" as const, partitaId: PARTITA },
    { id: 2, tipo: "correzione_punteggio" as const, partitaId: PARTITA },
    { id: 3, tipo: "ritiro" as const, partitaId: null },
  ];

  it("filtra per tipo, per partita e per entrambi", () => {
    expect(applicaFiltri(voci, NESSUN_FILTRO)).toHaveLength(3);
    expect(
      applicaFiltri(voci, { tipo: "ritiro", partita: null }).map((v) => v.id),
    ).toEqual([3]);
    expect(
      applicaFiltri(voci, { tipo: null, partita: PARTITA }).map((v) => v.id),
    ).toEqual([1, 2]);
    expect(
      applicaFiltri(voci, {
        tipo: "correzione_punteggio",
        partita: PARTITA,
      }).map((v) => v.id),
    ).toEqual([2]);
  });
});

describe("descriviFiltri", () => {
  it("riassume i filtri attivi", () => {
    const partite = [{ id: PARTITA, etichetta: "Girone A · Turno 1" }];
    expect(descriviFiltri(NESSUN_FILTRO, partite)).toBeNull();
    expect(
      descriviFiltri(
        { tipo: "correzione_punteggio", partita: PARTITA },
        partite,
      ),
    ).toBe("Correzione punteggio · Girone A · Turno 1");
    expect(
      descriviFiltri({ tipo: null, partita: crypto.randomUUID() }, partite),
    ).toBe("Partita non più presente");
  });
});
