import { describe, expect, it } from "vitest";
import { problemiDaDettaglio } from "./errori";

describe("problemiDaDettaglio", () => {
  it("legge il dettaglio di avvio_bloccato", () => {
    expect(
      problemiDaDettaglio(
        JSON.stringify([
          {
            regola: "girone_non_da_4",
            girone_id: "g1",
            girone_nome: "Girone A",
            dettaglio: "3",
          },
          {
            regola: "sconosciuta",
            girone_id: null,
            girone_nome: null,
            dettaglio: null,
          },
        ]),
      ),
    ).toEqual([
      {
        regola: "girone_non_da_4",
        gironeId: "g1",
        gironeNome: "Girone A",
        dettaglio: "3",
      },
    ]);
  });

  it("tollera un dettaglio vuoto o non valido", () => {
    expect(problemiDaDettaglio(null)).toEqual([]);
    expect(problemiDaDettaglio("{")).toEqual([]);
    expect(problemiDaDettaglio('{"a":1}')).toEqual([]);
  });
});
