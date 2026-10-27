import type { ImpattoFase } from "@/lib/punteggi/correzione/types";
import type {
  AnnullaPunteggioAction,
  SalvaPunteggioAction,
} from "@/lib/punteggi/state";
import type {
  ElencoPunteggi,
  GiocatorePartita,
  PartitaPunteggio,
  SchedaPunteggio,
} from "@/lib/punteggi/types";

const g = (id: string, nome: string, cognome: string): GiocatorePartita => ({
  iscrizioneId: id,
  nome,
  cognome,
});

const RINALDI = g("i1", "Luca", "Rinaldi");
const MORETTI = g("i2", "Marco", "Moretti");
const CONTI = g("i3", "Paolo", "Conti");
const GALLO = g("i4", "Andrea", "Gallo");

const tappa = {
  id: "jesolo",
  nome: "Tappa 1 · Jesolo",
  stato: "in_corso" as const,
};

function partita(
  turno: number,
  a: GiocatorePartita[],
  b: GiocatorePartita[],
  extra: Partial<PartitaPunteggio> = {},
): PartitaPunteggio {
  return {
    id: `jesolo-M-g1-t${turno}`,
    categoria: "M",
    gironeId: "jesolo-M-g1",
    gironeNome: "Girone A",
    turno,
    campo: turno === 1 ? "2" : null,
    stato: "programmata",
    sets: [],
    versione: 1,
    squadre: { a, b },
    ...extra,
  };
}

export const daInserire: SchedaPunteggio = {
  tappa,
  partita: partita(1, [RINALDI, MORETTI], [CONTI, GALLO]),
};

export const giaSalvata: SchedaPunteggio = {
  tappa,
  partita: partita(1, [RINALDI, MORETTI], [CONTI, GALLO], {
    stato: "conclusa",
    sets: [{ a: 21, b: 17 }],
    versione: 2,
  }),
};

export const nomiLunghi: SchedaPunteggio = {
  tappa: { ...tappa, nome: "Tappa 1 · Lignano Sabbiadoro, Spiaggia Pineta" },
  partita: partita(
    1,
    [
      g("i5", "Maria Vittoria", "Dell'Acqua Bianchi"),
      g("i6", "Anna", "Santangelo"),
    ],
    [g("i7", "Chiara", "Castiglioni"), g("i8", "Giulia", "Montecchio Ferri")],
  ),
};

export const nonGiocabile: SchedaPunteggio = {
  tappa: { ...tappa, stato: "conclusa" },
  partita: daInserire.partita,
};

export const elenco: ElencoPunteggi = {
  tappa,
  partite: [
    giaSalvata.partita,
    partita(2, [RINALDI, CONTI], [MORETTI, GALLO]),
    partita(3, [RINALDI, GALLO], [MORETTI, CONTI]),
    {
      ...partita(
        1,
        [g("i9", "Sara", "Ricci"), g("i10", "Elena", "Costa")],
        [g("i11", "Marta", "Greco"), g("i12", "Laura", "Fontana")],
      ),
      id: "jesolo-F-g1-t1",
      categoria: "F",
      gironeId: "jesolo-F-g1",
      stato: "conclusa",
      sets: [{ a: 19, b: 21 }],
      versione: 2,
    },
  ],
};

export const salvaFinto: SalvaPunteggioAction = async (prev, formData) => ({
  status: "success",
  partitaId: String(formData.get("partitaId")),
  versione: Number(formData.get("versione")) + 1,
  punteggio: {
    a: Number(formData.get("puntiA")),
    b: Number(formData.get("puntiB")),
  },
  tipo: "inserimento",
  message: "Punteggio salvato",
  at: prev.status === "idle" ? 1 : prev.at + 1,
});

/** Never resolves: the loading state of «Conferma e salva». */
export const salvaInCorso: SalvaPunteggioAction = () => new Promise(() => {});

export const annullaFinto: AnnullaPunteggioAction = async () => ({
  status: "success",
  message: "Salvataggio annullato: il punteggio è tornato com'era.",
});

/** BLVS-41: a finished group, to correct its first match. */
const gironeConcluso: PartitaPunteggio[] = [
  { ...giaSalvata.partita, sets: [{ a: 21, b: 18 }] },
  partita(2, [RINALDI, CONTI], [MORETTI, GALLO], {
    stato: "conclusa",
    sets: [{ a: 21, b: 15 }],
    versione: 2,
  }),
  partita(3, [RINALDI, GALLO], [MORETTI, CONTI], {
    stato: "conclusa",
    sets: [{ a: 17, b: 21 }],
    versione: 2,
  }),
];

export const correzione: SchedaPunteggio = {
  tappa,
  partita: gironeConcluso[0],
  girone: gironeConcluso,
};

/** w-admin-impatto-fase: two finals, one already scored. */
export const impattoFase: ImpattoFase = {
  punteggiPersi: 1,
  partite: [
    {
      id: "jesolo-M-finale-1",
      fase: "finale",
      turno: 1,
      stato: "conclusa",
      sets: [{ a: 21, b: 19 }],
      squadre: {
        a: ["Luca Rinaldi", "Paolo Conti"],
        b: ["Marco Moretti", "Andrea Gallo"],
      },
    },
    {
      id: "jesolo-M-finale-2",
      fase: "finale",
      turno: 2,
      stato: "programmata",
      sets: [],
      squadre: {
        a: ["Sara Ricci", "Elena Costa"],
        b: ["Marta Greco", "Laura Fontana"],
      },
    },
  ],
};

/**
 * Like `correggi_punteggio`: with no choice it answers «impatto»;
 * «Rigenera» needs the tick; then the correction is saved.
 */
export const salvaConImpatto: SalvaPunteggioAction = async (prev, formData) => {
  const at = prev.status === "idle" ? 1 : prev.at + 1;
  const mio = {
    a: Number(formData.get("puntiA")),
    b: Number(formData.get("puntiB")),
  };
  const scelta = formData.get("scelta");
  const versione = Number(formData.get("versione"));
  if (!scelta || (scelta === "rigenera" && formData.get("conferma") !== "on")) {
    return {
      status: "impatto",
      impatto: impattoFase,
      mio,
      versione,
      erroreConferma: scelta
        ? "Spunta la casella per confermare che perdi 1 punteggio."
        : null,
      avviso: null,
      message:
        "La fase successiva è già generata: scegli se mantenerla o rigenerarla.",
      at,
    };
  }
  return {
    status: "success",
    partitaId: String(formData.get("partitaId")),
    versione: versione + 1,
    punteggio: mio,
    tipo: "correzione",
    scelta: scelta === "rigenera" ? "rigenera" : "mantieni",
    punteggiPersi: scelta === "rigenera" ? 1 : 0,
    message: "Punteggio corretto",
    at,
  };
};

/** The request never reaches the server (network state). */
export const salvaSenzaRete: SalvaPunteggioAction = async () => {
  throw new TypeError("Failed to fetch");
};
