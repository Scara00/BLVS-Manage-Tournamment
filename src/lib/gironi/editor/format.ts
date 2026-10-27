import type { FaseGirone, FaseTabellone } from "@/lib/db/types";
import { coloreGirone, type LivelloGironi } from "@/lib/gironi/fasi/fase";
import type { ComposizioneGironi, GiocatoreGirone } from "./types";

/** What `public.gironi_editor(tabellone)` returns. */
export type GironiEditorJson = {
  tabellone_id: string;
  fase: FaseTabellone | null;
  /** Since BLVS-39. */
  livello?: LivelloGironi;
  versione: number;
  bloccata: boolean;
  gironi: {
    id: string;
    nome: string;
    posizione: number;
    /** Since BLVS-39. */
    fase?: FaseGirone;
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
    livello: json.livello ?? "iniziale",
    gironi: json.gironi.map((g) => ({
      id: g.id,
      nome: g.nome,
      posizione: g.posizione,
      // The group's own colour; the board's for an initial group.
      fase: (g.fase && coloreGirone(g.fase)) ?? json.fase,
      faseGirone: g.fase ?? "iniziale",
      giocatori: g.giocatori.map(giocatore),
    })),
    nonAssegnati: json.non_assegnati.map(giocatore),
  };
}
