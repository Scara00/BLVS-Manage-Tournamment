import { uominiDonne } from "@/lib/tappe/formato";
import {
  REGOLA_GIRONI,
  REGOLA_GIRONI_MISTA,
  type RegolaGironi,
} from "@/lib/tappe/gironi";
import type { ComposizioneGironi } from "./types";

export type CodiceControllo = "dimensione" | "misto" | "doppioni" | "assegnati";

export type Controllo = {
  codice: CodiceControllo;
  /** Short label of the rule, e.g. «4 giocatori per girone». */
  titolo: string;
  ok: boolean;
  /** What is wrong, one line per problem (empty when ok). */
  problemi: string[];
};

export type ControlliGironi = {
  controlli: Controllo[];
  valido: boolean;
  /** One sentence for the live region, e.g. «Tutti i controlli superati.». */
  riepilogo: string;
};

function giocatori(n: number) {
  return n === 1 ? "1 giocatore" : `${n} giocatori`;
}

/**
 * The three checks of the editor (R-24): every group has `dimensione`
 * players (and on a mixed board half men, half women), nobody is in two places, every confirmed player is in a group.
 * They are warnings: the admin may keep an incomplete group.
 */
export function controllaGironi(
  composizione: ComposizioneGironi,
  regolaData?: RegolaGironi,
  { misto = false }: { misto?: boolean } = {},
): ControlliGironi {
  // Without a rule the board's own: groups of 8 (4 + 4) on a mixed board.
  const regola = regolaData ?? (misto ? REGOLA_GIRONI_MISTA : REGOLA_GIRONI);
  const { dimensione } = regola;

  // Mixed board: every full group is half men, half women.
  const nonMisti = misto
    ? composizione.gironi
        .filter((g) => g.giocatori.length === dimensione)
        .flatMap((g) => {
          const uomini = g.giocatori.filter((p) => p.categoria === "M").length;
          const donne = g.giocatori.filter((p) => p.categoria === "F").length;
          return uomini === dimensione / 2 && donne === dimensione / 2
            ? []
            : [`${g.nome}: ${uominiDonne(uomini, donne)}.`];
        })
    : [];

  const fuoriMisura = composizione.gironi
    .filter((g) => g.giocatori.length !== dimensione)
    .map(
      (g) => `${g.nome}: ${giocatori(g.giocatori.length)} su ${dimensione}.`,
    );
  if (composizione.gironi.length === 0) {
    fuoriMisura.push("Non c'è ancora nessun girone.");
  }

  const posti = new Map<string, { nome: string; dove: string[] }>();
  const segna = (iscrizioneId: string, nome: string, dove: string) => {
    const voce = posti.get(iscrizioneId) ?? { nome, dove: [] };
    voce.dove.push(dove);
    posti.set(iscrizioneId, voce);
  };
  for (const girone of composizione.gironi) {
    for (const g of girone.giocatori)
      segna(g.iscrizioneId, g.nome, girone.nome);
  }
  for (const g of composizione.nonAssegnati) {
    segna(g.iscrizioneId, g.nome, "Non assegnati");
  }
  const doppioni = [...posti.values()]
    .filter((v) => v.dove.length > 1)
    .map((v) => `${v.nome} compare più volte: ${v.dove.join(", ")}.`);

  const daAssegnare = composizione.nonAssegnati.length;
  const nonAssegnati =
    daAssegnare === 0
      ? []
      : [
          daAssegnare === 1
            ? "1 giocatore non è in nessun girone."
            : `${daAssegnare} giocatori non sono in nessun girone.`,
        ];

  const controlli: Controllo[] = [
    {
      codice: "dimensione",
      titolo: `${dimensione} giocatori per girone`,
      ok: fuoriMisura.length === 0,
      problemi: fuoriMisura,
    },
    ...(misto
      ? [
          {
            codice: "misto" as const,
            titolo: `${uominiDonne(dimensione / 2, dimensione / 2)} per girone`,
            ok: nonMisti.length === 0,
            problemi: nonMisti,
          },
        ]
      : []),
    {
      codice: "doppioni",
      titolo: "Nessun doppione",
      ok: doppioni.length === 0,
      problemi: doppioni,
    },
    {
      codice: "assegnati",
      titolo: "Tutti assegnati",
      ok: nonAssegnati.length === 0,
      problemi: nonAssegnati,
    },
  ];
  const falliti = controlli.filter((c) => !c.ok);
  const riepilogo =
    falliti.length === 0
      ? "Tutti i controlli superati."
      : `${falliti.length === 1 ? "1 controllo da rivedere" : `${falliti.length} controlli da rivedere`}: ${falliti
          .flatMap((c) => c.problemi)
          .join(" ")}`;
  return { controlli, valido: falliti.length === 0, riepilogo };
}
