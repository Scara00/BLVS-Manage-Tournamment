import { describe, expect, it } from "vitest";
import { rifiutoRigenerazione } from "./errori";
import {
  avvisoPerdita,
  contaPunteggi,
  descriviPunteggioPerso,
  erroreConferma,
  messaggioPunteggiCambiati,
  messaggioSuccesso,
  toPunteggiPersi,
} from "./format";
import { RIGENERA_MESSAGES } from "./types";

const riga = {
  partita_id: "p1",
  girone: "Girone A",
  turno: 2,
  stato: "conclusa" as const,
  sets: [{ a: 21, b: 18 }, { a: 19, b: 21 }, { nonValido: true }],
  squadra_a: ["Giulia Bianchi", "Sara Colombo"],
  squadra_b: ["Marco Rossi", "Luca Ferrari"],
};

describe("perdita di punteggi", () => {
  it("conta al singolare e al plurale", () => {
    expect(contaPunteggi(1)).toBe("1 punteggio");
    expect(contaPunteggi(3)).toBe("3 punteggi");
    expect(avvisoPerdita(0)).toBe("Non si perde nessun punteggio.");
    expect(avvisoPerdita(1)).toBe(
      "Rigenerando perdi 1 punteggio già inserito.",
    );
    expect(avvisoPerdita(4)).toBe("Rigenerando perdi 4 punteggi già inseriti.");
    expect(erroreConferma(2)).toBe(
      "Spunta la casella per confermare che perdi 2 punteggi.",
    );
  });

  it("descrive quale punteggio si perde, a parole", () => {
    const [p] = toPunteggiPersi([riga]);
    expect(p.sets).toEqual([
      { a: 21, b: 18 },
      { a: 19, b: 21 },
    ]);
    expect(descriviPunteggioPerso(p)).toBe(
      "Girone A · turno 2: Giulia Bianchi e Sara Colombo contro Marco Rossi e Luca Ferrari, 21-18, 19-21",
    );
  });

  it("riassume l'esito con i punteggi persi", () => {
    expect(messaggioSuccesso(0, 4)).toBe("Gironi rigenerati: 4 gironi.");
    expect(messaggioSuccesso(1, 1)).toBe(
      "Gironi rigenerati: 1 girone. Perso 1 punteggio, annotati nel registro.",
    );
    expect(messaggioSuccesso(3, 2)).toBe(
      "Gironi rigenerati: 2 gironi. Persi 3 punteggi, annotati nel registro.",
    );
    expect(messaggioPunteggiCambiati(0)).toMatch(/non se ne perde nessuno/);
    expect(messaggioPunteggiCambiati(5)).toMatch(/ora se ne perdono 5/);
  });
});

describe("rifiutoRigenerazione", () => {
  it("riconosce i rifiuti del database", () => {
    expect(rifiutoRigenerazione({ hint: "conferma_richiesta" }).reason).toBe(
      "conflict",
    );
    expect(
      rifiutoRigenerazione({ code: "40001", hint: "punteggi_cambiati" }).reason,
    ).toBe("conflict");
    expect(rifiutoRigenerazione({ hint: "fase_successiva" })).toEqual({
      reason: "invalid",
      message: RIGENERA_MESSAGES.faseSuccessiva,
    });
    expect(rifiutoRigenerazione({ code: "42501" }).reason).toBe(
      "permissionDenied",
    );
    expect(rifiutoRigenerazione({ code: "P0002" }).reason).toBe("notFound");
    expect(rifiutoRigenerazione({ code: "XX000" }).reason).toBe("network");
  });
});
