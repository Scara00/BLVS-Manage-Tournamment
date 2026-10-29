import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { forbidden, notFound } from "next/navigation";
import { connection } from "next/server";
import { isUuid } from "@/lib/api/validation";
import { getCurrentUser } from "@/lib/auth/session";
import {
  DATI_VUOTI,
  type DatiClassificaGenerale,
} from "@/lib/classifica-generale/dati";
import {
  CATEGORIE,
  type Categoria,
  type Ruolo,
  type StatoIscrizione,
  type StatoTappa,
} from "@/lib/db/types";
import { getDemoDatiClassifica } from "@/lib/demo/classifica-generale";
import {
  demoEffettiCambio,
  demoGiocatoreAdmin,
  demoGiocatoriAdmin,
  demoIscrizioniGiocatore,
} from "@/lib/demo/giocatori-admin";
import { filtriRicerca } from "@/lib/iscrizioni/admin/search";
import { readSupabaseEnv } from "@/lib/supabase/env";
import { effettiDaRpc, type EffettiRpc } from "./effetti";
import {
  corrispondeRicerca,
  GIOCATORI_PER_PAGINA,
  paroleFiltro,
  type FiltriGiocatori,
} from "./filtri";
import { puntiPerStagione, spostamentoPunti } from "./punti";
import type {
  EffettiCambio,
  ElencoGiocatori,
  GiocatoreAdmin,
  IscrizioneGiocatore,
  SchedaGiocatoreAdmin,
} from "./types";

export type Lettura<T> =
  { status: "ok"; dati: T } | { status: "sessionExpired" };

type UtenteDb = {
  id: string;
  nome: string;
  cognome: string;
  email: string | null;
  categoria: Categoria | null;
  ruolo: Ruolo;
  categoria_verificata_il: string | null;
};

const COLONNE_UTENTE =
  "id, nome, cognome, email, categoria, ruolo, categoria_verificata_il";

function toGiocatore(u: UtenteDb): GiocatoreAdmin {
  return {
    id: u.id,
    nome: u.nome,
    cognome: u.cognome,
    email: u.email ?? "",
    categoria: u.categoria,
    ruolo: u.ruolo,
    daVerificare: u.categoria_verificata_il === null,
  };
}

function pagina<T>(
  righe: T[],
  totale: number,
  filtri: FiltriGiocatori,
): { giocatori: T[]; totale: number; pagina: number; pagine: number } {
  const pagine = Math.max(1, Math.ceil(totale / GIOCATORI_PER_PAGINA));
  return {
    giocatori: righe,
    totale,
    pagina: Math.min(filtri.pagina, pagine),
    pagine,
  };
}

async function adminSupabase(): Promise<SupabaseClient | "sessionExpired"> {
  const user = await getCurrentUser();
  if (!user) return "sessionExpired";
  if (user.ruolo !== "admin") forbidden();
  return user.supabase;
}

/**
 * w-admin-giocatori: every non-deleted account, searched by name, surname
 * or email (each word must match), optionally only the players whose
 * category is still to verify. Read through RLS with the admin's session.
 */
export async function readGiocatoriAdmin(
  filtri: FiltriGiocatori,
): Promise<Lettura<ElencoGiocatori>> {
  await connection();
  const parole = paroleFiltro(filtri);
  const da = (filtri.pagina - 1) * GIOCATORI_PER_PAGINA;

  if (!readSupabaseEnv()) {
    const tutti = demoGiocatoriAdmin().filter(
      (g) =>
        corrispondeRicerca(g, parole) &&
        (!filtri.daVerificare || (g.daVerificare && g.ruolo === "giocatore")),
    );
    return {
      status: "ok",
      dati: pagina(
        tutti.slice(da, da + GIOCATORI_PER_PAGINA),
        tutti.length,
        filtri,
      ),
    };
  }

  const supabase = await adminSupabase();
  if (supabase === "sessionExpired") return { status: "sessionExpired" };
  let query = supabase
    .from("utenti")
    .select(COLONNE_UTENTE, { count: "exact" });
  for (const filtro of filtriRicerca(parole)) query = query.or(filtro);
  if (filtri.daVerificare) {
    query = query.is("categoria_verificata_il", null).eq("ruolo", "giocatore");
  }
  const { data, count, error } = await query
    .order("cognome")
    .order("nome")
    .order("id")
    .range(da, da + GIOCATORI_PER_PAGINA - 1);
  if (error) throw new Error(`giocatori: ${error.message}`);
  return {
    status: "ok",
    dati: pagina(
      ((data ?? []) as UtenteDb[]).map(toGiocatore),
      count ?? 0,
      filtri,
    ),
  };
}

type IscrizioneDb = {
  id: string;
  stato: StatoIscrizione;
  posto: number | null;
  tabelloni: { categoria: Categoria } | null;
  tappe: {
    id: string;
    nome: string;
    data_inizio: string;
    stato: StatoTappa;
  } | null;
};

/** The proposed change to each category the player is not in. */
function cambi(
  giocatore: GiocatoreAdmin,
  dati: DatiClassificaGenerale,
  effetti: (a: Categoria) => Promise<EffettiRpc | null>,
): Promise<EffettiCambio[]> {
  return Promise.all(
    CATEGORIE.filter((a) => a !== giocatore.categoria).map(async (a) => {
      const rpc = (await effetti(a)) ?? {
        da: giocatore.categoria,
        a,
        iscrizioni: [],
        bloccanti: [],
      };
      return effettiDaRpc(
        rpc,
        giocatore.categoria
          ? spostamentoPunti(dati, giocatore.id, giocatore.categoria, a)
          : [],
      );
    }),
  );
}

function scheda(
  giocatore: GiocatoreAdmin,
  iscrizioni: IscrizioneGiocatore[],
  dati: DatiClassificaGenerale,
  proposte: EffettiCambio[],
): SchedaGiocatoreAdmin {
  return {
    giocatore,
    iscrizioni,
    punti: giocatore.categoria
      ? puntiPerStagione(dati, giocatore.id, giocatore.categoria)
      : [],
    cambi: proposte,
  };
}

/**
 * w-admin-giocatore: the profile, every registration, the points per
 * season and, for the confirmation, what a change of category would do.
 * Unknown or deleted account → 404.
 */
export async function readSchedaGiocatoreAdmin(
  id: string,
): Promise<Lettura<SchedaGiocatoreAdmin>> {
  await connection();

  if (!readSupabaseEnv()) {
    const giocatore = demoGiocatoreAdmin(id);
    if (!giocatore) notFound();
    const dati = giocatore.categoria
      ? getDemoDatiClassifica(giocatore.categoria, null)
      : DATI_VUOTI;
    return {
      status: "ok",
      dati: scheda(
        giocatore,
        demoIscrizioniGiocatore(id),
        dati,
        await cambi(giocatore, dati, async (a) => demoEffettiCambio(id, a)),
      ),
    };
  }

  const supabase = await adminSupabase();
  if (supabase === "sessionExpired") return { status: "sessionExpired" };
  if (!isUuid(id)) notFound();

  const { data: utente, error } = await supabase
    .from("utenti")
    .select(COLONNE_UTENTE)
    .eq("id", id)
    .maybeSingle<UtenteDb>();
  if (error) throw new Error(`giocatore: ${error.message}`);
  if (!utente) notFound();
  const giocatore = toGiocatore(utente);

  const [iscrizioni, dati] = await Promise.all([
    supabase
      .from("iscrizioni")
      .select(
        "id, stato, posto, tabelloni (categoria), tappe (id, nome, data_inizio, stato)",
      )
      .eq("utente_id", id),
    giocatore.categoria
      ? supabase.rpc("classifica_generale_dati", {
          p_categoria: giocatore.categoria,
          p_stagione: null,
        })
      : Promise.resolve({ data: DATI_VUOTI, error: null }),
  ]);
  if (iscrizioni.error) {
    throw new Error(`iscrizioni: ${iscrizioni.error.message}`);
  }
  if (dati.error) throw new Error(`classifica: ${dati.error.message}`);

  const righe = ((iscrizioni.data ?? []) as unknown as IscrizioneDb[])
    .flatMap((i): IscrizioneGiocatore[] =>
      i.tappe && i.tabelloni
        ? [
            {
              id: i.id,
              tappaId: i.tappe.id,
              tappa: i.tappe.nome,
              data: i.tappe.data_inizio,
              statoTappa: i.tappe.stato,
              stato: i.stato,
              categoria: i.tabelloni.categoria,
              posto: i.posto,
            },
          ]
        : [],
    )
    .sort(
      (a, b) =>
        b.data.localeCompare(a.data) || a.tappaId.localeCompare(b.tappaId),
    );

  const datiClassifica =
    (dati.data as DatiClassificaGenerale | null) ?? DATI_VUOTI;
  return {
    status: "ok",
    dati: scheda(
      giocatore,
      righe,
      datiClassifica,
      await cambi(giocatore, datiClassifica, async (a) => {
        const { data, error: e } = await supabase.rpc(
          "effetti_cambio_categoria",
          { p_utente: id, p_categoria: a },
        );
        if (e) throw new Error(`effetti: ${e.message}`);
        return data as EffettiRpc;
      }),
    ),
  };
}
