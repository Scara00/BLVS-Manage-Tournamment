import type { FaseTabellone } from "@/lib/db/types";
import type { ComposizioneGironi, GiocatoreGirone } from "./types";

/** What `public.gironi_editor(tabellone)` returns. */
export type GironiEditorJson = {
  tabellone_id: string;
  fase: FaseTabellone | null;
  versione: number;
  bloccata: boolean;
  gironi: {
    id: string;
    nome: string;
    posizione: number;
    giocatori: { iscrizione_id: string; nome: string }[];
  }[];
  non_assegnati: { iscrizione_id: string; nome: string }[];
};

const giocatore = (g: {
  iscrizione_id: string;
  nome: string;
}): GiocatoreGirone => ({
  iscrizioneId: g.iscrizione_id,
  nome: g.nome,
});

export function toComposizione(json: GironiEditorJson): ComposizioneGironi {
  return {
    tabelloneId: json.tabellone_id,
    fase: json.fase,
    versione: json.versione,
    bloccata: json.bloccata,
    gironi: json.gironi.map((g) => ({
      id: g.id,
      nome: g.nome,
      posizione: g.posizione,
      // One phase per board for now (see GironeEditor.fase).
      fase: json.fase,
      giocatori: g.giocatori.map(giocatore),
    })),
    nonAssegnati: json.non_assegnati.map(giocatore),
  };
}
