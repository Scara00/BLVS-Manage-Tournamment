import type {
  EffettiCambio,
  ElencoGiocatori,
  GiocatoreAdmin,
  SchedaGiocatoreAdmin,
} from "@/lib/giocatori/admin/types";

const g = (
  id: string,
  nome: string,
  cognome: string,
  categoria: GiocatoreAdmin["categoria"],
  daVerificare = false,
): GiocatoreAdmin => ({
  id,
  nome,
  cognome,
  email: `${nome}.${cognome}`.toLowerCase().replace(/\s+/g, "") + "@esempio.it",
  categoria,
  ruolo: "giocatore",
  daVerificare,
});

export const GIOCATORI: GiocatoreAdmin[] = [
  g("u1", "Marco", "Bianchi", "M"),
  g("u2", "Sara", "Costa", "F", true),
  g("u3", "Lorenzo", "Bruno-Gallo de Santis", "M"),
  g("u4", "Matteo", "Romano", "M", true),
  g("u5", "Luca", "Rossi", "M"),
  g("u6", "Giulia", "Ferrari", "F"),
  { ...g("u7", "Paola", "Arbitri", null), ruolo: "admin", daVerificare: true },
];

export function elenco(
  stato: "completo" | "daVerificare" | "vuoto" | "pagine",
): ElencoGiocatori {
  if (stato === "vuoto") {
    return { giocatori: [], totale: 0, pagina: 1, pagine: 1 };
  }
  if (stato === "daVerificare") {
    const giocatori = GIOCATORI.filter(
      (x) => x.daVerificare && x.ruolo === "giocatore",
    );
    return { giocatori, totale: giocatori.length, pagina: 1, pagine: 1 };
  }
  if (stato === "pagine") {
    return { giocatori: GIOCATORI, totale: 57, pagina: 2, pagine: 3 };
  }
  return {
    giocatori: GIOCATORI,
    totale: GIOCATORI.length,
    pagina: 1,
    pagine: 1,
  };
}

export function effettiVersoF(
  variante: "completo" | "bloccato" | "senzaEffetti" = "completo",
): EffettiCambio {
  if (variante === "senzaEffetti") {
    return { da: "M", a: "F", iscrizioni: [], bloccanti: [], punti: [] };
  }
  return {
    da: "M",
    a: "F",
    iscrizioni: [
      {
        iscrizioneId: "i-lignano",
        tappaId: "lignano",
        tappa: "Tappa 4 · Lignano",
        data: "2027-07-04",
        statoTappa: "iscrizioni_aperte",
        postoPrima: 7,
        postoDopo: 17,
        posti: 16,
        occupati: 16,
        oltreMassimo: true,
        inGirone: false,
      },
      {
        iscrizioneId: "i-sabaudia",
        tappaId: "sabaudia",
        tappa: "Tappa 5 · Sabaudia",
        data: "2027-07-18",
        statoTappa: "iscrizioni_chiuse",
        postoPrima: 3,
        postoDopo: 6,
        posti: 16,
        occupati: 5,
        oltreMassimo: false,
        inGirone: true,
      },
    ],
    bloccanti:
      variante === "bloccato"
        ? [{ tappaId: "rimini", tappa: "Tappa 2 · Rimini", data: "2027-06-20" }]
        : [],
    punti: [
      {
        stagione: 2027,
        punti: 20,
        tappe: 2,
        provvisori: true,
        posizionePrima: 3,
        posizioneDopo: 5,
      },
      {
        stagione: 2026,
        punti: 32,
        tappe: 3,
        provvisori: false,
        posizionePrima: 1,
        posizioneDopo: 2,
      },
    ],
  };
}

export function scheda(
  variante: "completo" | "bloccato" | "senzaEffetti" = "completo",
): SchedaGiocatoreAdmin {
  return {
    giocatore: g("u5", "Luca", "Rossi", "M", true),
    iscrizioni: [
      {
        id: "i-sabaudia",
        tappaId: "sabaudia",
        tappa: "Tappa 5 · Sabaudia",
        data: "2027-07-18",
        statoTappa: "iscrizioni_chiuse",
        stato: "confermata",
        categoria: "M",
        posto: 3,
      },
      {
        id: "i-lignano",
        tappaId: "lignano",
        tappa: "Tappa 4 · Lignano",
        data: "2027-07-04",
        statoTappa: "iscrizioni_aperte",
        stato: "in_attesa",
        categoria: "M",
        posto: 7,
      },
      {
        id: "i-jesolo",
        tappaId: "jesolo",
        tappa: "Tappa 1 · Jesolo",
        data: "2027-06-14",
        statoTappa: "conclusa",
        stato: "confermata",
        categoria: "M",
        posto: 1,
      },
    ],
    punti: [
      {
        stagione: 2027,
        categoria: "M",
        posizione: 3,
        punti: 20,
        tappe: 2,
        provvisori: true,
      },
      {
        stagione: 2026,
        categoria: "M",
        posizione: 1,
        punti: 32,
        tappe: 3,
        provvisori: false,
      },
    ],
    cambi: [effettiVersoF(variante)],
  };
}
