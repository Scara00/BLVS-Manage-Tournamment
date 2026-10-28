import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { connection } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import {
  classificaDaDati,
  leggiClassificaGenerale,
  leggiStagioni,
} from "@/lib/classifica-generale/dati";
import { stagioneScelta } from "@/lib/classifica-generale/stagione";
import type { ClassificaGenerale } from "@/lib/classifica-generale/types";
import type { Categoria, StatoIscrizione, StatoTappa } from "@/lib/db/types";
import {
  DEMO_ME_CLASSIFICA,
  getDemoDatiClassifica,
  getDemoStagioni,
} from "@/lib/demo/classifica-generale";
import {
  DEMO_GIOCATORE_COOKIE,
  demoDettaglioTappa,
  demoIscrizioniGiocatore,
} from "@/lib/demo/tappa-dettaglio";
import { demoTappeGiocatore } from "@/lib/demo/tournament";
import { readSupabaseEnv } from "@/lib/supabase/env";
import { getServerTimeParts, now } from "@/lib/time/server-time";
import {
  dividiIscrizioni,
  riepilogoStagione,
  risultatoDaClassifica,
  toIscrizioneMia,
  type IscrizioneMiaRow,
  type MieIscrizioniView,
} from "./mie";

/** Stages with a standing to read results from (BLVS-44). */
const CON_CLASSIFICA: readonly StatoTappa[] = [
  "in_corso",
  "conclusa",
  "archiviata",
];

type Lettura = {
  me: string;
  categoria: Categoria | null;
  righe: IscrizioneMiaRow[];
  stagioni: number[];
  classifica: (
    categoria: Categoria,
    stagione: number,
  ) => Promise<ClassificaGenerale>;
};

type RigaDb = {
  id: string;
  stato: StatoIscrizione;
  posto: number | null;
  tabelloni: { categoria: Categoria } | null;
  girone_iscrizioni: { girone_id: string }[] | null;
  tappe: IscrizioneMiaRow["tappa"] | null;
};

async function leggiSupabase(): Promise<Lettura | null> {
  const user = await getCurrentUser();
  if (!user) return null;
  const supabase: SupabaseClient = user.supabase;
  const [iscrizioni, profilo, stagioni] = await Promise.all([
    supabase
      .from("iscrizioni")
      .select(
        "id, stato, posto, tabelloni (categoria), girone_iscrizioni (girone_id), tappe (id, nome, luogo, data_inizio, data_fine, stato, stagione, iscrizioni_chiudono_il, annullabile_fino_al)",
      )
      .eq("utente_id", user.id)
      .returns<RigaDb[]>(),
    supabase
      .from("utenti")
      .select("categoria")
      .eq("id", user.id)
      .maybeSingle<{ categoria: Categoria | null }>(),
    leggiStagioni(supabase),
  ]);
  if (iscrizioni.error)
    throw new Error(`iscrizioni: ${iscrizioni.error.message}`);
  if (profilo.error) throw new Error(`utenti: ${profilo.error.message}`);

  const righe = (iscrizioni.data ?? []).flatMap((r): IscrizioneMiaRow[] =>
    // A draft is hidden by RLS: the embedded stage is null.
    r.tappe && r.tappe.stato !== "bozza"
      ? [
          {
            id: r.id,
            stato: r.stato,
            posto: r.posto,
            categoria: r.tabelloni?.categoria ?? profilo.data?.categoria ?? "M",
            inGirone: (r.girone_iscrizioni?.length ?? 0) > 0,
            tappa: r.tappe,
          },
        ]
      : [],
  );
  return {
    me: user.id,
    categoria: profilo.data?.categoria ?? null,
    righe,
    stagioni,
    classifica: (categoria, stagione) =>
      leggiClassificaGenerale(supabase, categoria, stagione),
  };
}

/**
 * Demo (no Supabase env): the demo player is «Luca Rossi» of the overall
 * standing demo (past stages, no pages of their own) plus the seats this
 * browser took on the demo calendar (cookie).
 */
async function leggiDemo(): Promise<Lettura> {
  const giocatore = (await cookies()).get(DEMO_GIOCATORE_COOKIE)?.value;
  const categoria = demoTappeGiocatore.categoria;
  const dati = getDemoDatiClassifica(categoria, null);
  const passate = dati.iscrizioni
    .filter((i) => i.utente_id === DEMO_ME_CLASSIFICA)
    .flatMap((i): IscrizioneMiaRow[] => {
      const tappa = dati.tappe.find((t) => t.id === i.tappa_id);
      if (!tappa) return [];
      return [
        {
          id: i.id,
          stato: i.stato,
          posto: null,
          categoria,
          inGirone: true,
          apribile: false,
          tappa: {
            id: tappa.id,
            nome: tappa.nome,
            luogo: "",
            data_inizio: tappa.data_inizio,
            data_fine: tappa.data_inizio,
            stato: tappa.concluso ? "conclusa" : "in_corso",
            stagione: tappa.stagione,
            iscrizioni_chiudono_il: null,
            annullabile_fino_al: null,
          },
        },
      ];
    });
  const calendario = demoIscrizioniGiocatore(giocatore).flatMap(
    (i): IscrizioneMiaRow[] => {
      const row = demoDettaglioTappa(i.tappaId);
      if (!row || row.stato === "bozza") return [];
      return [
        {
          id: i.tappaId,
          stato: i.stato,
          posto: i.posto,
          categoria,
          inGirone: false,
          tappa: { ...row, stagione: Number(row.data_inizio.slice(0, 4)) },
        },
      ];
    },
  );
  return {
    me: DEMO_ME_CLASSIFICA,
    categoria,
    righe: [...calendario, ...passate],
    stagioni: getDemoStagioni(),
    classifica: async (cat, stagione) =>
      classificaDaDati(getDemoDatiClassifica(cat, stagione), cat, stagione),
  };
}

/**
 * w-mie-iscrizioni for the signed-in player, with the server clock; null
 * without a session. Results and the season summary come from the overall
 * standing (BLVS-44), computed once per category and season.
 */
export async function readMieIscrizioni(): Promise<MieIscrizioniView | null> {
  await connection();
  const lettura = readSupabaseEnv() ? await leggiSupabase() : await leggiDemo();
  if (!lettura) return null;
  const at = now();

  const cache = new Map<string, Promise<ClassificaGenerale>>();
  const classifica = (categoria: Categoria, stagione: number) => {
    const chiave = `${categoria}:${stagione}`;
    let valore = cache.get(chiave);
    if (!valore) {
      valore = lettura.classifica(categoria, stagione);
      cache.set(chiave, valore);
    }
    return valore;
  };

  const iscrizioni = await Promise.all(
    lettura.righe.map(async (row) => {
      const risultato = CON_CLASSIFICA.includes(row.tappa.stato)
        ? risultatoDaClassifica(
            (await classifica(row.categoria, row.tappa.stagione)).righe,
            lettura.me,
            row.tappa.id,
          )
        : null;
      return toIscrizioneMia(row, risultato, at);
    }),
  );

  const categoria = lettura.categoria ?? lettura.righe[0]?.categoria ?? null;
  const stagione = stagioneScelta(
    null,
    lettura.stagioni,
    getServerTimeParts(at).year,
  );
  return {
    ...dividiIscrizioni(iscrizioni),
    stagione: categoria
      ? riepilogoStagione(
          {
            stagione,
            categoria,
            righe: (await classifica(categoria, stagione)).righe,
          },
          lettura.me,
        )
      : null,
  };
}
