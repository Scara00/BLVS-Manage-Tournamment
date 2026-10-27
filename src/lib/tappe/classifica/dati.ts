/**
 * Reads a category's final groups through a Supabase client and builds
 * its stage standing. RLS applies: player names and registration states
 * are visible to admins (and to each player for their own row only).
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Categoria, FaseTabellone, StatoIscrizione } from "@/lib/db/types";
import {
  toPartitaGirone,
  type DecisioneSpareggio,
  type PartitaGironeRow,
} from "@/lib/gironi/classifica";
import {
  classificaTappa,
  type ClassificaTappa,
  type FinaleTappa,
} from "./classifica";

/**
 * The phase of a final group from its `gironi.fase` (BLVS-39: `iniziale`,
 * `gold`, `silver`, `finale_gold`, `finale_silver`), or undefined when the
 * group is not a final. The ONE place that knows how finals are marked.
 */
export function faseDellaFinale(
  faseGirone: string | null,
): FaseTabellone | undefined {
  if (faseGirone === "finale_gold") return "gold";
  if (faseGirone === "finale_silver") return "silver";
  return undefined;
}

export type GironeRow = { id: string; fase: string | null };

export type IscrizioneRow = {
  id: string;
  stato: StatoIscrizione;
  /** Many-to-one embed: PostgREST returns an object (or null under RLS). */
  utente:
    | { nome: string; cognome: string }
    | { nome: string; cognome: string }[]
    | null;
};

export type DatiFinali = {
  gironi: readonly GironeRow[];
  membri: readonly { girone_id: string; iscrizione_id: string }[];
  partite: readonly (PartitaGironeRow & { girone_id: string | null })[];
  iscrizioni: readonly IscrizioneRow[];
  decisioni: readonly (DecisioneSpareggio & { girone_id: string })[];
};

function nomeIscrizione(row: IscrizioneRow | undefined, id: string): string {
  const utente = Array.isArray(row?.utente) ? row.utente[0] : row?.utente;
  const nome = utente ? `${utente.nome} ${utente.cognome}`.trim() : "";
  return nome || id;
}

/**
 * The finals of a board from its rows. A final's players are its group
 * members plus anyone who played one of its matches, so a withdrawn
 * player removed from the group still keeps the last place.
 */
export function toFinaliTappa(dati: DatiFinali): FinaleTappa[] {
  const iscrizioni = new Map(dati.iscrizioni.map((i) => [i.id, i]));
  return dati.gironi.flatMap((girone) => {
    const fase = faseDellaFinale(girone.fase);
    if (fase === undefined) return [];
    const partite = dati.partite.filter((p) => p.girone_id === girone.id);
    const ids = new Set([
      ...dati.membri
        .filter((m) => m.girone_id === girone.id)
        .map((m) => m.iscrizione_id),
      ...partite.flatMap((p) =>
        p.partita_giocatori.map((g) => g.iscrizione_id),
      ),
    ]);
    return [
      {
        gironeId: girone.id,
        fase,
        giocatori: [...ids].sort().map((id) => ({
          iscrizioneId: id,
          nome: nomeIscrizione(iscrizioni.get(id), id),
          ritirato: iscrizioni.get(id)?.stato === "ritirata",
        })),
        partite: partite.map(toPartitaGirone),
        decisioni: dati.decisioni
          .filter((d) => d.girone_id === girone.id)
          .map(({ firma, ordine }) => ({ firma, ordine })),
      },
    ];
  });
}

/**
 * The stage standing of `categoria` in `tappaId`, recomputed from the
 * matches on every call; null when the stage has no such board.
 */
export async function leggiClassificaTappa(
  supabase: SupabaseClient,
  tappaId: string,
  categoria: Categoria,
): Promise<ClassificaTappa | null> {
  const tabellone = await supabase
    .from("tabelloni")
    .select("id, concluso_il")
    .eq("tappa_id", tappaId)
    .eq("categoria", categoria)
    .maybeSingle();
  if (tabellone.error) {
    throw new Error(`classifica tappa: ${tabellone.error.message}`);
  }
  if (!tabellone.data) return null;
  const board = tabellone.data as { id: string; concluso_il: string | null };

  const gironi = await supabase
    .from("gironi")
    .select("id, fase")
    .eq("tabellone_id", board.id);
  if (gironi.error)
    throw new Error(`classifica tappa: ${gironi.error.message}`);
  const finali = (gironi.data as GironeRow[]).filter(
    (g) => faseDellaFinale(g.fase) !== undefined,
  );
  const idFinali = finali.map((g) => g.id);
  const concluso = board.concluso_il !== null;
  if (idFinali.length === 0) return classificaTappa({ finali: [], concluso });

  const [membri, partite, decisioni] = await Promise.all([
    supabase
      .from("girone_iscrizioni")
      .select("girone_id, iscrizione_id")
      .in("girone_id", idFinali),
    supabase
      .from("partite")
      .select(
        "id, girone_id, stato, punteggi(sets), partita_giocatori(iscrizione_id, squadra)",
      )
      .in("girone_id", idFinali),
    supabase
      .from("spareggi_girone")
      .select("girone_id, firma, ordine")
      .in("girone_id", idFinali),
  ]);
  for (const { error } of [membri, partite, decisioni]) {
    if (error) throw new Error(`classifica tappa: ${error.message}`);
  }
  const righeMembri = membri.data as DatiFinali["membri"];
  const righePartite = partite.data as DatiFinali["partite"];
  const ids = [
    ...new Set([
      ...righeMembri.map((m) => m.iscrizione_id),
      ...righePartite.flatMap((p) =>
        p.partita_giocatori.map((g) => g.iscrizione_id),
      ),
    ]),
  ];
  const iscrizioni = await supabase
    .from("iscrizioni")
    .select("id, stato, utente:utenti(nome, cognome)")
    .in("id", ids);
  if (iscrizioni.error) {
    throw new Error(`classifica tappa: ${iscrizioni.error.message}`);
  }

  return classificaTappa({
    finali: toFinaliTappa({
      gironi: finali,
      membri: righeMembri,
      partite: righePartite,
      iscrizioni: iscrizioni.data as IscrizioneRow[],
      decisioni: decisioni.data as DatiFinali["decisioni"],
    }),
    concluso,
  });
}
