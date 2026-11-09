import { describe, expect, it } from "vitest";
import { toAdminTappa, type AdminTappaRpcRow } from "@/lib/admin/tappe";
import { controllaGironi } from "@/lib/gironi/editor/controlli";
import { toTabelloneView } from "@/lib/iscrizioni/admin/format";
import type { IscrittoRow } from "@/lib/iscrizioni/admin/types";
import {
  controllaAvvio,
  controlliView,
  messaggioProblema,
  partiteGirone,
  regolaAvvio,
  riepilogoAvvio,
  type GironeAvvio,
} from "@/lib/tappe/avvio/regole";
import {
  categorieTabelloni,
  parseTabelloneSegmento,
  postiPerQuota,
} from "@/lib/tappe/formato";
import { NUOVA_TAPPA_MESSAGES } from "@/lib/tappe/nuova/types";
import { validaNuovaTappa } from "@/lib/tappe/nuova/validation";
import type { TappaModifica } from "@/lib/tappe/modifica/types";
import { validaTappaModifica } from "@/lib/tappe/modifica/validation";

function giocatore(lettera: string, categoria: "M" | "F") {
  return {
    iscrizioneId: `i-${lettera}`,
    utenteId: `u-${lettera}`,
    lettera,
    nome: lettera,
    cognome: "Rossi",
    categoria,
  };
}

/** Men A-D, women E-H, as `giocatori_girone` gives them. */
const gironeMisto: GironeAvvio = {
  id: "g1",
  nome: "Girone A",
  giocatori: [
    ..."ABCD".split("").map((l) => giocatore(l, "M")),
    ..."EFGH".split("").map((l) => giocatore(l, "F")),
  ],
};

describe("formato", () => {
  it("le tappe miste hanno il solo tabellone X, segmento x", () => {
    expect(categorieTabelloni("misto")).toEqual(["X"]);
    expect(categorieTabelloni("classico")).toEqual(["M", "F"]);
    expect(parseTabelloneSegmento("x")).toBe("X");
    expect(parseTabelloneSegmento("y")).toBeNull();
    expect(postiPerQuota(32)).toBe(16);
  });
});

describe("avvio nel misto", () => {
  it("8 partite in 4 turni da 2: ogni uomo fa coppia una volta con ogni donna", () => {
    const partite = partiteGirone(gironeMisto, true);
    expect(partite).toHaveLength(8);
    expect(partite.map((p) => p.numero)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect(partite.map((p) => p.turno)).toEqual([1, 1, 2, 2, 3, 3, 4, 4]);

    const squadre = partite.flatMap((p) => [p.squadraA, p.squadraB]);
    for (const squadra of squadre) {
      expect(squadra.map((g) => g.categoria).sort()).toEqual(["F", "M"]);
    }
    const coppie = squadre.map((s) => s.map((g) => g.lettera).join(""));
    expect(new Set(coppie).size).toBe(16);
    for (const uomo of "ABCD") {
      expect(coppie.filter((c) => c.startsWith(uomo)).sort()).toEqual(
        "EFGH".split("").map((donna) => `${uomo}${donna}`),
      );
    }
    for (const turno of [1, 2, 3, 4]) {
      const inCampo = partite
        .filter((p) => p.turno === turno)
        .flatMap((p) => [...p.squadraA, ...p.squadraB])
        .map((g) => g.lettera);
      expect(inCampo.sort().join("")).toBe("ABCDEFGH");
    }
    expect(
      riepilogoAvvio({ categoria: "X", gironi: [gironeMisto] }).partite,
    ).toBe(8);
  });

  it("un girone misto ancora da 4 non ha partite e blocca l'avvio", () => {
    const vecchio: GironeAvvio = {
      ...gironeMisto,
      giocatori: [
        giocatore("A", "M"),
        giocatore("B", "M"),
        giocatore("C", "F"),
        giocatore("D", "F"),
      ],
    };
    expect(partiteGirone(vecchio, true)).toEqual([]);
    const problemi = controllaAvvio({
      categoria: "X",
      gironi: [vecchio],
      nonAssegnati: [],
    });
    expect(problemi).toEqual([
      {
        regola: "girone_non_da_4",
        gironeId: "g1",
        gironeNome: "Girone A",
        dettaglio: "4",
      },
    ]);
    expect(messaggioProblema(problemi[0], regolaAvvio("X"))).toBe(
      "Girone A: ha 4 giocatori invece di 8.",
    );
  });

  it("un girone da 8 che non è 4 + 4 blocca l'avvio", () => {
    const sbilanciato: GironeAvvio = {
      ...gironeMisto,
      giocatori: [
        ..."ABCDE".split("").map((l) => giocatore(l, "M")),
        ..."FGH".split("").map((l) => giocatore(l, "F")),
      ],
    };
    const problemi = controllaAvvio({
      categoria: "X",
      gironi: [sbilanciato],
      nonAssegnati: [],
    });
    expect(problemi).toEqual([
      {
        regola: "girone_non_misto",
        gironeId: "g1",
        gironeNome: "Girone A",
        dettaglio: "5:3",
      },
    ]);
    expect(messaggioProblema(problemi[0], regolaAvvio("X"))).toBe(
      "Girone A: ha 5 uomini e 3 donne invece di 4 uomini e 4 donne.",
    );
    expect(
      controllaAvvio({
        categoria: "X",
        gironi: [gironeMisto],
        nonAssegnati: [],
      }),
    ).toEqual([]);
  });

  it("il classico resta com'era: gironi da 4, 3 partite, nessuna categoria", () => {
    const classico: GironeAvvio = {
      ...gironeMisto,
      giocatori: [
        giocatore("A", "M"),
        giocatore("B", "M"),
        giocatore("C", "M"),
        giocatore("D", "F"),
      ],
    };
    expect(partiteGirone(classico).map((p) => p.turno)).toEqual([1, 2, 3]);
    expect(controllaAvvio({ gironi: [classico], nonAssegnati: [] })).toEqual(
      [],
    );
    expect(controlliView([])[0].label).toBe("Gironi da 4");
    expect(controlliView([], true)[0].label).toBe(
      "Gironi da 4 uomini e 4 donne",
    );
  });
});

describe("editor dei gironi nel misto", () => {
  const composizione = (
    giocatori: { nome: string; categoria: "M" | "F" }[],
  ) => ({
    tabelloneId: "t",
    fase: null,
    versione: 1,
    bloccata: false,
    gironi: [
      {
        id: "g1",
        nome: "Girone A",
        posizione: 1,
        fase: null,
        giocatori: giocatori.map((g) => ({ iscrizioneId: g.nome, ...g })),
      },
    ],
    nonAssegnati: [],
  });
  const tutti = (uomini: number, donne: number) => [
    ...Array.from({ length: uomini }, (_, i) => ({
      nome: `M${i}`,
      categoria: "M" as const,
    })),
    ...Array.from({ length: donne }, (_, i) => ({
      nome: `F${i}`,
      categoria: "F" as const,
    })),
  ];

  it("vuole gironi da 8 = 4 uomini + 4 donne", () => {
    const giusto = controllaGironi(composizione(tutti(4, 4)), undefined, {
      misto: true,
    });
    expect(giusto.valido).toBe(true);
    expect(giusto.controlli.map((c) => c.titolo)).toEqual([
      "8 giocatori per girone",
      "4 uomini e 4 donne per girone",
      "Nessun doppione",
      "Tutti assegnati",
    ]);

    const sbilanciato = controllaGironi(composizione(tutti(5, 3)), undefined, {
      misto: true,
    });
    expect(
      sbilanciato.controlli.find((c) => c.codice === "misto"),
    ).toMatchObject({ ok: false, problemi: ["Girone A: 5 uomini e 3 donne."] });

    const daQuattro = controllaGironi(composizione(tutti(2, 2)), undefined, {
      misto: true,
    });
    expect(
      daQuattro.controlli.find((c) => c.codice === "dimensione"),
    ).toMatchObject({ ok: false, problemi: ["Girone A: 4 giocatori su 8."] });
  });

  it("nel classico 4 giocatori qualsiasi vanno bene", () => {
    expect(controllaGironi(composizione(tutti(3, 1))).valido).toBe(true);
  });
});

describe("iscritti del tabellone misto", () => {
  const riga = (id: string, categoriaGiocatore: "M" | "F"): IscrittoRow => ({
    id,
    posto: Number(id.slice(1)),
    stato: "confermata",
    created_at: "2027-05-01T10:00:00Z",
    categoria: "X",
    categoriaGiocatore,
    nome: id,
    cognome: "Rossi",
    email: `${id}@example.it`,
  });

  it("mostra le due metà e chiude solo quella piena", () => {
    const view = toTabelloneView({ categoria: "X", posti: 4 }, [
      riga("i1", "M"),
      riga("i2", "M"),
      riga("i3", "F"),
    ]);
    expect(view.label).toBe("Misto");
    expect(
      view.quote.map((q) => [q.label, q.occupati, q.posti, q.pieno]),
    ).toEqual([
      ["Uomini", 2, 2, true],
      ["Donne", 1, 2, false],
    ]);
    expect(view.pieno).toBe(false);
    expect(view.iscritti.map((i) => i.categoriaLabel)).toEqual([
      "Uomo",
      "Uomo",
      "Donna",
    ]);
  });
});

describe("riepilogo admin di una tappa mista", () => {
  it("riempie le colonne M e F con le metà del tabellone misto", () => {
    const row: AdminTappaRpcRow = {
      id: "t",
      nome: "K&Q",
      data_inizio: "2027-07-01",
      data_fine: "2027-07-01",
      stato: "iscrizioni_aperte",
      motivo_annullamento: null,
      categorie: [
        {
          categoria: "X",
          posti: 32,
          fase: null,
          concluso: false,
          iscritti: 9,
          iscritti_m: 5,
          iscritti_f: 4,
        },
      ],
      partite_da_inserire: 0,
    };
    expect(toAdminTappa(row, "2027-06-01").categorie).toEqual([
      {
        categoria: "M",
        iscritti: 5,
        posti: 16,
        fase: null,
        concluso: false,
        misto: true,
      },
      {
        categoria: "F",
        iscritti: 4,
        posti: 16,
        fase: null,
        concluso: false,
        misto: true,
      },
    ]);
  });
});

describe("nuova tappa mista", () => {
  function form(values: Record<string, string>) {
    const data = new FormData();
    const base = {
      formato: "misto",
      nome: "K&Q misto",
      luogo: "Jesolo",
      data: "2099-07-01",
      scadenza: "2099-06-28T20:00",
      posti: "32",
    };
    for (const [k, v] of Object.entries({ ...base, ...values })) {
      data.set(k, v);
    }
    return data;
  }
  const adesso = new Date("2099-06-01T10:00:00Z");

  it("un solo massimo, multiplo di 8", () => {
    expect(validaNuovaTappa(form({}), adesso)).toMatchObject({
      ok: true,
      values: { formato: "misto", posti: 32 },
    });
    for (const posti of ["31", "12", "4"]) {
      expect(validaNuovaTappa(form({ posti }), adesso)).toEqual({
        ok: false,
        fields: { posti: NUOVA_TAPPA_MESSAGES.postiMisto },
      });
    }
  });

  it("un formato sconosciuto è un errore", () => {
    expect(validaNuovaTappa(form({ formato: "coppie" }), adesso)).toMatchObject(
      { ok: false, fields: { formato: NUOVA_TAPPA_MESSAGES.formato } },
    );
  });
});

describe("modifica di una tappa mista", () => {
  const tappa: TappaModifica = {
    id: "t1",
    nome: "K&Q",
    luogo: "Jesolo",
    data: "2099-07-01",
    dataFine: "2099-07-01",
    scadenza: "2099-06-28T20:00",
    stato: "iscrizioni_aperte",
    versione: 1,
    formato: "misto",
    // 5 uomini e 3 donne: il massimo non scende sotto 16 (10 → multiplo di 8).
    tabelloni: { X: { posti: 16, iscritti: 16 } },
  };
  function form(posti: string) {
    const data = new FormData();
    data.set("nome", tappa.nome);
    data.set("luogo", tappa.luogo);
    data.set("data", tappa.data);
    data.set("scadenza", tappa.scadenza);
    data.set("posti", posti);
    return data;
  }
  const adesso = new Date("2099-06-01T10:00:00Z");

  it("il massimo resta un multiplo di 8 e non scende sotto la metà più piena", () => {
    expect(validaTappaModifica(form("24"), tappa, adesso)).toMatchObject({
      ok: true,
      values: { postiM: 24, postiF: 24 },
    });
    expect(validaTappaModifica(form("20"), tappa, adesso)).toMatchObject({
      ok: false,
      fields: { posti: expect.stringContaining("multiplo di 8") },
    });
    expect(validaTappaModifica(form("8"), tappa, adesso)).toMatchObject({
      ok: false,
      fields: { posti: "Il massimo non può scendere sotto 16" },
    });
  });
});
