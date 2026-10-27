import { REGOLA_GIRONI, type RegolaGironi } from "@/lib/tappe/gironi";
import type { ComposizioneGironi } from "./types";

export type CodiceControllo = "dimensione" | "doppioni" | "assegnati";

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
 * players, nobody is in two places, every confirmed player is in a group.
 * They are warnings: the admin may keep an incomplete group.
 */
export function controllaGironi(
  composizione: ComposizioneGironi,
  regola: RegolaGironi = REGOLA_GIRONI,
): ControlliGironi {
  const { dimensione } = regola;

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
