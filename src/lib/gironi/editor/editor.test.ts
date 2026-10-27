import { describe, expect, it } from "vitest";
import { annuncioModifica, descriviOperazione } from "./annunci";
import { controllaGironi } from "./controlli";
import { composizioneDemo } from "./fixtures";
import {
  applicaOperazione,
  gironiCoinvolti,
  posizioneGiocatore,
  prossimoNomeGirone,
} from "./operazioni";
import {
  NON_ASSEGNATI,
  gironiEditorPath,
  parseCategoriaSegmento,
  type ComposizioneGironi,
  type OperazioneGironi,
} from "./types";

function applica(c: ComposizioneGironi, op: OperazioneGironi) {
  const esito = applicaOperazione(c, op, () => "nuovo");
  if (!esito.ok) throw new Error(esito.errore);
  return esito.composizione;
}

const ids = (c: ComposizioneGironi, gironeId: string) =>
  c.gironi.find((g) => g.id === gironeId)!.giocatori.map((g) => g.iscrizioneId);

describe("spostamento", () => {
  it("toglie il giocatore dal suo girone e lo mette in fondo all'altro", () => {
    const prima = composizioneDemo();
    const dopo = applica(prima, {
      tipo: "sposta",
      iscrizioneId: "i1",
      verso: "g2",
    });
    expect(ids(dopo, "g1")).toEqual(["i2", "i3", "i4"]);
    expect(ids(dopo, "g2")).toEqual(["i5", "i6", "i7", "i8", "i1"]);
    // Pure: the input is unchanged.
    expect(ids(prima, "g1")).toEqual(["i1", "i2", "i3", "i4"]);
  });

  it("sposta tra i non assegnati e da lì in un girone", () => {
    const c = composizioneDemo({ giocatori: 17 });
    expect(posizioneGiocatore(c, "i17")).toBe(NON_ASSEGNATI);
    const fuori = applica(c, {
      tipo: "sposta",
      iscrizioneId: "i2",
      verso: NON_ASSEGNATI,
    });
    expect(fuori.nonAssegnati.map((g) => g.iscrizioneId)).toEqual([
      "i17",
      "i2",
    ]);
    const dentro = applica(fuori, {
      tipo: "sposta",
      iscrizioneId: "i17",
      verso: "g1",
    });
    expect(ids(dentro, "g1")).toEqual(["i1", "i3", "i4", "i17"]);
  });

  it("nello stesso girone non cambia nulla", () => {
    const c = composizioneDemo();
    expect(
      applica(c, { tipo: "sposta", iscrizioneId: "i1", verso: "g1" }),
    ).toBe(c);
  });

  it("rifiuta giocatori o gironi sconosciuti", () => {
    const c = composizioneDemo();
    expect(
      applicaOperazione(c, { tipo: "sposta", iscrizioneId: "x", verso: "g1" }),
    ).toEqual({
      ok: false,
      errore: "giocatore_non_trovato",
    });
    expect(
      applicaOperazione(c, { tipo: "sposta", iscrizioneId: "i1", verso: "gx" }),
    ).toEqual({
      ok: false,
      errore: "girone_non_trovato",
    });
  });
});

describe("scambio", () => {
  it("ognuno prende il posto (e la riga) dell'altro", () => {
    const dopo = applica(composizioneDemo(), {
      tipo: "scambia",
      a: "i2",
      b: "i7",
    });
    expect(ids(dopo, "g1")).toEqual(["i1", "i7", "i3", "i4"]);
    expect(ids(dopo, "g2")).toEqual(["i5", "i6", "i2", "i8"]);
  });

  it("scambia anche con un non assegnato", () => {
    const dopo = applica(composizioneDemo({ giocatori: 17 }), {
      tipo: "scambia",
      a: "i17",
      b: "i1",
    });
    expect(ids(dopo, "g1")).toEqual(["i17", "i2", "i3", "i4"]);
    expect(dopo.nonAssegnati.map((g) => g.iscrizioneId)).toEqual(["i1"]);
  });

  it("nello stesso girone non cambia nulla", () => {
    const c = composizioneDemo();
    expect(applica(c, { tipo: "scambia", a: "i1", b: "i2" })).toBe(c);
  });
});

describe("aggiunta ed eliminazione dei gironi", () => {
  it("il nuovo girone prende il primo nome libero e l'ultima posizione", () => {
    const c = applica(composizioneDemo(), { tipo: "elimina", gironeId: "g2" });
    const dopo = applica(c, { tipo: "aggiungi" });
    expect(dopo.gironi.at(-1)).toMatchObject({
      id: "nuovo",
      nome: "Girone B",
      posizione: 5,
      fase: "gold",
      giocatori: [],
    });
  });

  it("eliminando un girone i suoi giocatori diventano non assegnati", () => {
    const dopo = applica(composizioneDemo(), {
      tipo: "elimina",
      gironeId: "g1",
    });
    expect(dopo.gironi.map((g) => g.id)).toEqual(["g2", "g3", "g4"]);
    expect(dopo.nonAssegnati.map((g) => g.iscrizioneId)).toEqual([
      "i1",
      "i2",
      "i3",
      "i4",
    ]);
  });

  it("dopo Z usa i numeri", () => {
    const tutti = Array.from({ length: 26 }, (_, i) => ({
      nome: `Girone ${String.fromCharCode(65 + i)}`,
    }));
    expect(prossimoNomeGirone(tutti)).toBe("Girone 27");
    expect(prossimoNomeGirone([])).toBe("Girone A");
  });

  it("indica i gironi toccati da ogni modifica", () => {
    const c = composizioneDemo({ giocatori: 17 });
    expect(
      gironiCoinvolti(c, { tipo: "sposta", iscrizioneId: "i1", verso: "g3" }),
    ).toEqual(["g1", "g3"]);
    expect(gironiCoinvolti(c, { tipo: "scambia", a: "i17", b: "i5" })).toEqual([
      "g2",
    ]);
    expect(gironiCoinvolti(c, { tipo: "elimina", gironeId: "g4" })).toEqual([
      "g4",
    ]);
    expect(gironiCoinvolti(c, { tipo: "aggiungi" })).toEqual([]);
  });
});

describe("controlli", () => {
  it("gironi completi, nessun doppione, tutti assegnati", () => {
    const esito = controllaGironi(composizioneDemo());
    expect(esito.valido).toBe(true);
    expect(esito.controlli.map((c) => [c.titolo, c.ok])).toEqual([
      ["4 giocatori per girone", true],
      ["Nessun doppione", true],
      ["Tutti assegnati", true],
    ]);
    expect(esito.riepilogo).toBe("Tutti i controlli superati.");
  });

  it("segnala i gironi fuori misura e i non assegnati, aggiornati a ogni modifica", () => {
    const dopo = applica(composizioneDemo(), {
      tipo: "sposta",
      iscrizioneId: "i1",
      verso: NON_ASSEGNATI,
    });
    const esito = controllaGironi(dopo);
    expect(esito.valido).toBe(false);
    expect(esito.controlli[0].problemi).toEqual([
      "Girone A: 3 giocatori su 4.",
    ]);
    expect(esito.controlli[2].problemi).toEqual([
      "1 giocatore non è in nessun girone.",
    ]);
    expect(esito.riepilogo).toBe(
      "2 controlli da rivedere: Girone A: 3 giocatori su 4. 1 giocatore non è in nessun girone.",
    );
  });

  it("segnala un giocatore in due posti", () => {
    const c = composizioneDemo();
    c.gironi[1].giocatori.push(c.gironi[0].giocatori[0]);
    const esito = controllaGironi(c);
    expect(esito.controlli[1]).toMatchObject({
      ok: false,
      problemi: ["Giulia Bianchi compare più volte: Girone A, Girone B."],
    });
  });

  it("senza gironi il controllo della misura non passa", () => {
    const esito = controllaGironi(composizioneDemo({ giocatori: 3 }));
    expect(esito.controlli[0].problemi).toContain(
      "Non c'è ancora nessun girone.",
    );
  });
});

describe("annunci", () => {
  it("descrive la modifica e poi i controlli", () => {
    const prima = composizioneDemo();
    const op: OperazioneGironi = { tipo: "scambia", a: "i1", b: "i5" };
    expect(annuncioModifica(prima, applica(prima, op), op)).toBe(
      "Scambiati Giulia Bianchi e Chiara Esposito: Giulia Bianchi ora è nel Girone B, Chiara Esposito nel Girone A. Tutti i controlli superati.",
    );
    expect(
      descriviOperazione(prima, {
        tipo: "sposta",
        iscrizioneId: "i2",
        verso: NON_ASSEGNATI,
      }),
    ).toBe("Marco Rossi spostato tra i non assegnati.");
    expect(descriviOperazione(prima, { tipo: "elimina", gironeId: "g1" })).toBe(
      "Girone A eliminato. 4 giocatori sono passati tra i non assegnati.",
    );
    expect(descriviOperazione(prima, { tipo: "aggiungi" })).toBe(
      "Girone E aggiunto.",
    );
  });
});

describe("percorsi", () => {
  it("usa m/f nell'URL", () => {
    expect(gironiEditorPath("rimini", "F")).toBe(
      "/admin/tappe/rimini/gironi/f",
    );
    expect(parseCategoriaSegmento("M")).toBe("M");
    expect(parseCategoriaSegmento("x")).toBeNull();
  });
});
