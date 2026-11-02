import { describe, expect, it } from "vitest";
import { toAdminTappa, type AdminTappaRpcRow } from "@/lib/admin/tappe";
import { controllaGironi } from "@/lib/gironi/editor/controlli";
import { toTabelloneView } from "@/lib/iscrizioni/admin/format";
import type { IscrittoRow } from "@/lib/iscrizioni/admin/types";
import {
  controllaAvvio,
  messaggioProblema,
  partiteGirone,
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

const gironeMisto: GironeAvvio = {
  id: "g1",
  nome: "Girone A",
  giocatori: [
    giocatore("A", "M"),
    giocatore("B", "M"),
    giocatore("C", "F"),
    giocatore("D", "F"),
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
  it("2 partite per girone, con coppie sempre uomo + donna", () => {
    const partite = partiteGirone(gironeMisto, true);
    expect(
      partite.map((p) => [
        p.squadraA.map((g) => g.lettera),
        p.squadraB.map((g) => g.lettera),
      ]),
    ).toEqual([
      [
        ["A", "C"],
        ["B", "D"],
      ],
      [
        ["A", "D"],
        ["B", "C"],
      ],
    ]);
    expect(partiteGirone(gironeMisto)).toHaveLength(3);
    expect(
      riepilogoAvvio({ categoria: "X", gironi: [gironeMisto] }).partite,
    ).toBe(2);
  });

  it("un girone da 4 che non è 2 + 2 blocca l'avvio", () => {
    const sbilanciato: GironeAvvio = {
      ...gironeMisto,
      giocatori: [
        giocatore("A", "M"),
        giocatore("B", "M"),
        giocatore("C", "M"),
        giocatore("D", "F"),
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
        dettaglio: "3:1",
      },
    ]);
    expect(messaggioProblema(problemi[0])).toBe(
      "Girone A: ha 3 uomini e 1 donna invece di 2 uomini e 2 donne.",
    );
    // Il classico non guarda le categorie.
    expect(controllaAvvio({ gironi: [sbilanciato], nonAssegnati: [] })).toEqual(
      [],
    );
    expect(
      controllaAvvio({
        categoria: "X",
        gironi: [gironeMisto],
        nonAssegnati: [],
      }),
    ).toEqual([]);
  });
});

describe("editor dei gironi nel misto", () => {
  it("segnala i gironi che non sono 2 uomini + 2 donne", () => {
    const composizione = {
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
          giocatori: [
            { iscrizioneId: "a", nome: "A", categoria: "M" as const },
            { iscrizioneId: "b", nome: "B", categoria: "M" as const },
            { iscrizioneId: "c", nome: "C", categoria: "M" as const },
            { iscrizioneId: "d", nome: "D", categoria: "F" as const },
          ],
        },
      ],
      nonAssegnati: [],
    };
    const misto = controllaGironi(composizione, undefined, { misto: true });
    expect(misto.valido).toBe(false);
    expect(misto.controlli.find((c) => c.codice === "misto")).toMatchObject({
      ok: false,
      problemi: ["Girone A: 3 uomini e 1 donna."],
    });
    expect(controllaGironi(composizione).valido).toBe(true);
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

  it("un solo massimo, pari", () => {
    expect(validaNuovaTappa(form({}), adesso)).toMatchObject({
      ok: true,
      values: { formato: "misto", posti: 32 },
    });
    expect(validaNuovaTappa(form({ posti: "31" }), adesso)).toEqual({
      ok: false,
      fields: { posti: NUOVA_TAPPA_MESSAGES.postiDispari },
    });
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
    // 6 uomini e 3 donne: il massimo non scende sotto 12.
    tabelloni: { X: { posti: 16, iscritti: 12 } },
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

  it("il massimo resta pari e non scende sotto il doppio della metà più piena", () => {
    expect(validaTappaModifica(form("20"), tappa, adesso)).toMatchObject({
      ok: true,
      values: { postiM: 20, postiF: 20 },
    });
    expect(validaTappaModifica(form("21"), tappa, adesso)).toMatchObject({
      ok: false,
      fields: { posti: expect.stringContaining("pari") },
    });
    expect(validaTappaModifica(form("10"), tappa, adesso)).toMatchObject({
      ok: false,
      fields: { posti: "Il massimo non può scendere sotto 12" },
    });
  });
});
