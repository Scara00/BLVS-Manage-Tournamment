import "server-only";
import { cookies } from "next/headers";
import { connection } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { calcolaClassificaGenerale } from "@/lib/classifica-generale/read";
import { stagioneDaData } from "@/lib/classifica-generale/stagione";
import type { Categoria, StatoIscrizione } from "@/lib/db/types";
import { DEMO_ME_CLASSIFICA } from "@/lib/demo/classifica-generale";
import {
  DEMO_GIOCATORE_COOKIE,
  demoPostoPreso,
} from "@/lib/demo/tappa-dettaglio";
import { demoTappeGiocatore } from "@/lib/demo/tournament";
import { readLiveTappa } from "@/lib/live/tappa-read";
import { readSupabaseEnv } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import { romeToday } from "@/lib/time/rome-local";
import {
  toTappeGiocatore,
  type PostiRow,
  type TappaGiocatoreRow,
} from "@/lib/tappe/format";
import type { Home, VistaHome } from "./types";
import { scegliVista, type IscrizioneHome } from "./vista";

/**
 * Demo only (no Supabase env): «today» as `YYYY-MM-DD`, so e2e and manual
 * checks reach the race day of the demo calendar (Jesolo, 14–15 June
 * 2027) or the empty home. Ignored with Supabase.
 */
export const DEMO_OGGI_COOKIE = "blvs_demo_oggi";

const GIORNO = /^\d{4}-\d{2}-\d{2}$/;

/** The demo player («Luca Rossi»): men's seat 1 of Jesolo (w-live demo). */
const DEMO_NOME = "Luca";

type TappaHome = TappaGiocatoreRow & { stagione: number };

type Lettura = {
  nome: string | null;
  categoria: Categoria | null;
  /** `utenti.id` for the overall standing. */
  utente: string;
  oggi: string;
  tappe: TappaHome[];
  posti: PostiRow[];
  iscrizioni: IscrizioneHome[];
};

async function leggiDemo(): Promise<Lettura> {
  const jar = await cookies();
  const oggi = jar.get(DEMO_OGGI_COOKIE)?.value;
  const giocatore = jar.get(DEMO_GIOCATORE_COOKIE)?.value;
  const tappe = demoTappeGiocatore.tappe.map((t) => ({
    ...t,
    stagione: stagioneDaData(t.data_inizio),
  }));
  const iscrizioni: IscrizioneHome[] = [
    { tappaId: "jesolo", stato: "confermata", posto: 1 },
  ];
  for (const t of tappe) {
    const posto = demoPostoPreso(giocatore, t.id);
    // A seat taken in the demo w-tappa waits for confirmation (BLVS-24).
    if (posto) iscrizioni.push({ tappaId: t.id, stato: "in_attesa", posto });
  }
  return {
    nome: DEMO_NOME,
    categoria: demoTappeGiocatore.categoria,
    utente: DEMO_ME_CLASSIFICA,
    oggi: oggi && GIORNO.test(oggi) ? oggi : romeToday(),
    tappe,
    posti: [...demoTappeGiocatore.posti],
    iscrizioni,
  };
}

async function leggiSupabase(): Promise<Lettura | null> {
  const user = await getCurrentUser();
  if (!user) return null;
  const supabase = await createClient();
  const [tappe, posti, iscrizioni, profilo] = await Promise.all([
    supabase
      .from("tappe")
      .select(
        "id, nome, luogo, data_inizio, data_fine, stato, iscrizioni_chiudono_il, stagione",
      )
      .neq("stato", "bozza")
      .order("data_inizio", { ascending: true }),
    supabase.rpc("posti_tappe"),
    user.supabase
      .from("iscrizioni")
      .select("tappa_id, stato, posto")
      .eq("utente_id", user.id),
    user.supabase
      .from("utenti")
      .select("nome, categoria")
      .eq("id", user.id)
      .maybeSingle<{ nome: string; categoria: Categoria | null }>(),
  ]);
  if (tappe.error) throw new Error(`tappe: ${tappe.error.message}`);
  if (posti.error) throw new Error(`posti_tappe: ${posti.error.message}`);
  if (iscrizioni.error) {
    throw new Error(`iscrizioni: ${iscrizioni.error.message}`);
  }
  return {
    nome: profilo.data?.nome ?? null,
    categoria: profilo.data?.categoria ?? null,
    utente: user.id,
    oggi: romeToday(),
    tappe: tappe.data as TappaHome[],
    posti: posti.data as PostiRow[],
    iscrizioni: (
      iscrizioni.data as {
        tappa_id: string;
        stato: StatoIscrizione;
        posto: number | null;
      }[]
    ).map((i) => ({ tappaId: i.tappa_id, stato: i.stato, posto: i.posto })),
  };
}

/**
 * w-home (BLVS-52) for the signed-in player. On the race day of one of
 * their stages it reuses w-live's read (BLVS-36) plus their row of the
 * overall standing (BLVS-44); on other days the next stage with their
 * registration; else the empty state.
 */
export async function readHome(): Promise<Home> {
  await connection();
  const lettura = readSupabaseEnv() ? await leggiSupabase() : await leggiDemo();
  if (!lettura) return { status: "sessionExpired" };

  const scelta = scegliVista(lettura);
  const giocatore = toTappeGiocatore(
    lettura.tappe,
    lettura.posti,
    lettura.categoria,
  );
  let vista: VistaHome = { tipo: "vuota" };

  if (scelta.tipo === "gara") {
    const live = await readLiveTappa(scelta.tappaId);
    if (live.status === "sessionExpired") return { status: "sessionExpired" };
    if (live.status === "ok") {
      const riga = lettura.tappe.find((t) => t.id === scelta.tappaId);
      const generale =
        lettura.categoria && riga
          ? ((
              await calcolaClassificaGenerale(lettura.categoria, riga.stagione)
            ).rows.find((r) => r.playerId === lettura.utente) ?? null)
          : null;
      vista = {
        tipo: "gara",
        tappa: live.tappa,
        sync: live.sync,
        me: live.me,
        fasi: live.fasi,
        categoria: lettura.categoria,
        generale,
      };
    }
  }
  if (vista.tipo === "vuota" && scelta.tipo !== "vuota") {
    // Also when w-live cannot read the stage: the card still helps.
    const tappa = giocatore.find((t) => t.id === scelta.tappaId);
    if (tappa) {
      vista = { tipo: "prossima", tappa, iscrizione: scelta.iscrizione };
    }
  }

  return { status: "ok", nome: lettura.nome, vista };
}
