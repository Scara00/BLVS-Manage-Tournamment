import type { Categoria, StatoPartita } from "@/lib/db/types";
import { punteggioPath } from "@/lib/punteggi/paths";
import { CATEGORIA_TABELLONE } from "@/lib/tappe/gestione-format";
import { adminLivePath } from "@/lib/tappe/live-admin/paths";
import type { RisultatoPalette } from "./types";

type Nome = { nome: string; cognome: string };

/** A row of `public.cerca_partite_admin()` (or its demo equivalent). */
export type PartitaTrovataRow = {
  partita_id: string;
  tappa_id: string;
  tappa_nome: string;
  categoria: Categoria;
  /** partite.fase: 'gironi' | 'eliminazione' | 'finale'. */
  fase: string;
  girone_nome: string | null;
  turno: number;
  stato: StatoPartita;
  sets: { a: number; b: number }[];
  squadra_a: Nome[];
  squadra_b: Nome[];
};

const STATO_PARTITA_TESTO: Record<StatoPartita, string> = {
  programmata: "Da giocare",
  in_corso: "In corso",
  conclusa: "Conclusa",
  annullata: "Annullata",
};

function squadra(giocatori: readonly Nome[]): string {
  return giocatori.length > 0
    ? giocatori.map((g) => g.cognome || g.nome).join(" e ")
    : "Da definire";
}

/**
 * «Rossi e Bianchi contro Verdi e Neri». A group match opens its score
 * entry (w-admin-punteggio); the finals are entered from w-admin-live.
 */
export function toRisultatoPartita(row: PartitaTrovataRow): RisultatoPalette {
  const punteggio = row.sets.map((s) => `${s.a}–${s.b}`).join(", ");
  const stato = punteggio
    ? `${STATO_PARTITA_TESTO[row.stato]} ${punteggio}`
    : STATO_PARTITA_TESTO[row.stato];
  const dove = [
    row.tappa_nome,
    CATEGORIA_TABELLONE[row.categoria],
    row.girone_nome
      ? `${row.girone_nome}, turno ${row.turno}`
      : `Turno ${row.turno}`,
    stato,
  ];
  return {
    tipo: "partita",
    id: row.partita_id,
    titolo: `${squadra(row.squadra_a)} contro ${squadra(row.squadra_b)}`,
    dettaglio: dove.join(" · "),
    href:
      row.fase === "gironi"
        ? punteggioPath(row.tappa_id, row.partita_id)
        : adminLivePath(row.tappa_id, row.categoria),
  };
}
