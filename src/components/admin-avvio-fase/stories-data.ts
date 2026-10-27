import { toAvvioFaseView } from "@/lib/tappe/avvio/format";
import {
  controllaAvvio,
  type GironeAvvio,
  type TabelloneAvvio,
} from "@/lib/tappe/avvio/regole";
import type { AvvioFaseAction } from "@/lib/tappe/avvio/state";

const COGNOMI = [
  "Rossi",
  "Bianchi",
  "Marino",
  "Greco",
  "Ferrari",
  "Costa",
  "Esposito",
  "Romano",
  "Colombo",
  "Ricci",
  "Fontana",
  "Moretti",
];

function girone(k: number, cognomi: readonly string[]): GironeAvvio {
  const lettera = String.fromCharCode(65 + k);
  return {
    id: `g${k + 1}`,
    nome: `Girone ${lettera}`,
    giocatori: cognomi.map((cognome, i) => ({
      iscrizioneId: `i-${k}-${i}`,
      utenteId: `u-${cognome}`,
      lettera: String.fromCharCode(65 + i),
      nome: "Luca",
      cognome,
    })),
  };
}

const base: TabelloneAvvio = {
  tappa: {
    id: "cagliari",
    nome: "Tappa 3 · Cagliari",
    stato: "iscrizioni_chiuse",
  },
  categoria: "M",
  tabelloneId: "tb-m",
  faseGioco: null,
  gironi: [
    girone(0, COGNOMI.slice(0, 4)),
    girone(1, COGNOMI.slice(4, 8)),
    girone(2, COGNOMI.slice(8, 12)),
  ],
  nonAssegnati: [],
};

function view(tabellone: TabelloneAvvio) {
  return toAvvioFaseView(tabellone, controllaAvvio(tabellone));
}

/** Three full groups: the start is offered behind a confirmation. */
export const pronta = view(base);

/** A group of 3 and a player in no group. */
export const bloccata = view({
  ...base,
  gironi: [base.gironi[0], base.gironi[1], girone(2, COGNOMI.slice(8, 11))],
  nonAssegnati: [{ iscrizioneId: "x", nome: "Marta", cognome: "Moretti" }],
});

/** Already started: the matches exist. */
export const avviata = view({
  ...base,
  tappa: { ...base.tappa, stato: "in_corso" },
  faseGioco: "gironi_iniziali",
});

/** Long names, for 200% text and narrow screens. */
export const nomiLunghi = view({
  ...base,
  tappa: {
    ...base.tappa,
    nome: "Tappa 3 · Cagliari, Poetto – Ospedale Marino e Lungomare",
  },
  gironi: [
    girone(0, [
      "Bianchi-Fontanarosa",
      "De Santis Colombo",
      "Dell'Acqua Moretti",
      "Esposito Romano",
    ]),
  ],
});

/** The server refuses with one error per group. */
export const erroriServer = bloccata.problemi;

export const avviaFinta: AvvioFaseAction = async (prev) => ({
  status: "success",
  partite: 9,
  message:
    "Gironi iniziali avviati per il tabellone maschile: 9 partite create.",
  at: prev.status === "idle" ? 1 : prev.at + 1,
});

/** Never resolves: the loading state of the confirm button. */
export const avviaInCorso: AvvioFaseAction = () => new Promise(() => {});
