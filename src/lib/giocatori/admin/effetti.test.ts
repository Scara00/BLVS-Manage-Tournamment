import { describe, expect, it } from "vitest";
import { effettiVersoF } from "@/components/admin-giocatori/fixtures";
import {
  effettiAttesi,
  leggiAttesi,
  messaggioCambio,
  testiEffetti,
} from "./effetti";
import { erroreCambio, messaggioErrore } from "./errori";
import { filtriHref, leggiFiltri } from "./filtri";

describe("testi degli effetti", () => {
  it("iscrizioni, posti e punti per stagione", () => {
    const testi = testiEffetti(effettiVersoF());
    expect(testi.iscrizioni[1]).toBe(
      "Tappa 5 · Sabaudia (18 luglio 2027): dal posto 3 del tabellone maschile al posto 6 di 16 del femminile. Esce dai gironi già proposti: vanno rivisti.",
    );
    expect(testi.punti[0]).toBe(
      "Stagione 2027: 20 punti (2 tappe), in parte provvisori, passano dalla classifica maschile (ora 3º) a quella femminile (sarà 5º).",
    );
    expect(testi.bloccanti).toEqual([]);
  });

  it("senza effetti lo dice", () => {
    expect(testiEffetti(effettiVersoF("senzaEffetti"))).toEqual({
      iscrizioni: ["Nessuna iscrizione a tappe future da spostare."],
      punti: ["Nessun punto in classifica generale da spostare."],
      bloccanti: [],
    });
  });

  it("messaggio di esito", () => {
    expect(messaggioCambio("Luca Rossi", "F", 2)).toBe(
      "Categoria di Luca Rossi cambiata in Femminile. 2 iscrizioni spostate nel tabellone femminile.",
    );
    expect(messaggioCambio("Luca Rossi", "M", 0)).toBe(
      "Categoria di Luca Rossi cambiata in Maschile.",
    );
  });
});

describe("effetti attesi", () => {
  it("andata e ritorno dal campo del modulo", () => {
    const attesi = effettiAttesi(effettiVersoF());
    expect(leggiAttesi(JSON.stringify(attesi))).toEqual(attesi);
    expect(leggiAttesi("[]")).toEqual([]);
    expect(leggiAttesi("{")).toBeNull();
    expect(leggiAttesi('[{"iscrizione_id":1}]')).toBeNull();
  });
});

describe("errori", () => {
  it("dai codici del database", () => {
    expect(erroreCambio({ code: "42501" })).toBe("permissionDenied");
    expect(erroreCambio({ code: "40001", hint: "effetti_cambiati" })).toBe(
      "effettiCambiati",
    );
    expect(erroreCambio({ code: "23514", hint: "tappa_in_corso" })).toBe(
      "tappaInCorso",
    );
    expect(messaggioErrore("tappaInCorso", "Tappa 2 · Rimini")).toContain(
      "Tappa 2 · Rimini, in corso",
    );
  });
});

describe("filtri", () => {
  it("legge e scrive la query", () => {
    const filtri = leggiFiltri({ q: " rossi ", verifica: "1", pagina: "3" });
    expect(filtri).toEqual({ q: "rossi", daVerificare: true, pagina: 3 });
    expect(filtriHref(filtri)).toBe(
      "/admin/giocatori?q=rossi&verifica=1&pagina=3",
    );
    expect(leggiFiltri({ pagina: "-1" })).toEqual({
      q: "",
      daVerificare: false,
      pagina: 1,
    });
  });
});
