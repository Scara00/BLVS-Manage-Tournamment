import type { Categoria, FaseGioco } from "@/lib/db/types";
import { FASE_GIOCO_LABEL } from "@/lib/gironi/fasi/fase";
import { CATEGORIA_NOME } from "./paths";
import {
  avvioNonDisponibile,
  controlliView,
  faseAvviata,
  faseDaAvviare,
  partiteGirone,
  riepilogoAvvio,
  type ControlloView,
  type GironeAvvio,
  type PartitaAnteprima,
  type ProblemaAvvio,
  type RiepilogoAvvio,
  type TabelloneAvvio,
} from "./regole";

/** Everything w-admin-avvio-fase shows for one board. */
export type AvvioFaseView = {
  tappa: TabelloneAvvio["tappa"];
  categoria: Categoria;
  /** «Tabellone maschile». */
  tabelloneLabel: string;
  /** The phase this screen starts, and its name in lower case. */
  fase: FaseGioco;
  /** «gironi iniziali», «gironi gold e silver». */
  faseLabel: string;
  /** The board's current phase (null = not started). */
  faseGioco: FaseGioco | null;
  avviata: boolean;
  riepilogo: RiepilogoAvvio;
  controlli: ControlloView[];
  problemi: ProblemaAvvio[];
  anteprima: { girone: GironeAvvio; partite: PartitaAnteprima[] }[];
  /** Why the button is not offered at all (already started, wrong state). */
  nonDisponibile: string | null;
};

export function toAvvioFaseView(
  tabellone: TabelloneAvvio,
  problemi: ProblemaAvvio[],
): AvvioFaseView {
  return {
    tappa: tabellone.tappa,
    categoria: tabellone.categoria,
    tabelloneLabel: `Tabellone ${CATEGORIA_NOME[tabellone.categoria]}`,
    fase: faseDaAvviare(tabellone),
    faseLabel: FASE_GIOCO_LABEL[faseDaAvviare(tabellone)].toLowerCase(),
    faseGioco: tabellone.faseGioco,
    avviata: faseAvviata(tabellone),
    riepilogo: riepilogoAvvio(tabellone),
    controlli: controlliView(problemi),
    problemi,
    anteprima: tabellone.gironi.map((girone) => ({
      girone,
      partite: partiteGirone(girone),
    })),
    nonDisponibile: avvioNonDisponibile(tabellone),
  };
}

/** «3 gironi», «1 girone». */
export function contaLabel(
  n: number,
  singolare: string,
  plurale: string,
): string {
  return `${n} ${n === 1 ? singolare : plurale}`;
}

/**
 * The start button: «Avvia le 6 partite», «Avvia la partita», generic when
 * no group can make matches yet.
 */
export function avviaLabel(
  partite: number,
  fase: FaseGioco = "gironi_iniziali",
): string {
  if (partite === 0) return `Avvia i ${FASE_GIOCO_LABEL[fase].toLowerCase()}`;
  return partite === 1 ? "Avvia la partita" : `Avvia le ${partite} partite`;
}
