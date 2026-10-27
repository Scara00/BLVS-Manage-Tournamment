import type { Categoria } from "@/lib/db/types";
import {
  ordineValido,
  paritaPerfette,
  type PartitaGirone,
} from "@/lib/gironi/classifica";
import type {
  DatiParitaGirone,
  DecisioneParita,
} from "@/lib/gironi/parita/format";
import { now } from "@/lib/time/server-time";
import {
  avviaFaseDemo,
  creaDemoAvvioFase,
  getDemoAvvioFase,
} from "./avvio-fase";
import {
  cambiaStatoDemo,
  getDemoTabelloneLive,
  salvaPunteggioDemo,
} from "./admin-live";
import { sostituisciDemoGironi } from "./gironi-editor";
import { aggiungiVoceDemoRegistro } from "./registro";

/**
 * Tie decisions of the demo groups when Supabase is not configured (CI,
 * e2e). The standings come from w-admin-live's demo matches, so a score
 * saved there changes them; this keeps only what `spareggi_girone` would
 * hold, and writes the `parita_risolta` entry the RPC writes. One server
 * instance, reset on restart, like the other demo stores.
 */
type Store = Map<string, DecisioneParita[]>;

const STORE_KEY = Symbol.for("blvs.demo.parita");

/** The demo has no accounts: every decision is the demo admin's. */
export const AUTORE_DEMO = "Admin demo";

function store(): Store {
  const g = globalThis as unknown as Record<symbol, Store | undefined>;
  return (g[STORE_KEY] ??= new Map());
}

/** Every group of a demo board with its matches and decisions. */
export function getDemoDatiParita(
  tappaId: string,
  categoria: Categoria,
): DatiParitaGirone[] | null {
  const tabellone = getDemoAvvioFase(tappaId, categoria);
  if (!tabellone) return null;
  const partite =
    getDemoTabelloneLive(tappaId, categoria, now())?.partite ?? [];
  return tabellone.gironi.map((g) => ({
    tappaId,
    categoria,
    gironeId: g.id,
    gironeNome: g.nome,
    giocatori: g.giocatori
      .map((p) => ({
        iscrizioneId: p.iscrizioneId,
        nome: `${p.nome} ${p.cognome}`.trim(),
      }))
      .sort((a, b) => (a.iscrizioneId < b.iscrizioneId ? -1 : 1)),
    partite: partite
      .filter((p) => p.gironeId === g.id)
      .map((p): PartitaGirone => ({
        id: p.id,
        stato: p.stato,
        squadre: {
          A: p.squadraA.map((x) => x.iscrizioneId),
          B: p.squadraB.map((x) => x.iscrizioneId),
        },
        sets: p.sets,
      })),
    decisioni: (store().get(g.id) ?? []).map((d) => ({
      ...d,
      ordine: [...d.ordine],
    })),
  }));
}

export type EsitoDemoParita =
  | { ok: true; dati: DatiParitaGirone }
  | { ok: false; motivo: "nonTrovato" | "conflict" | "ordineNonValido" };

/** Same rules and effects as `risolviParitaGirone` + `risolvi_parita_girone`. */
export function risolviParitaDemo({
  tappaId,
  categoria,
  gironeId,
  firma,
  ordine,
  motivo,
}: {
  tappaId: string;
  categoria: Categoria;
  gironeId: string;
  firma: string;
  ordine: readonly string[];
  motivo: string;
}): EsitoDemoParita {
  const girone = getDemoDatiParita(tappaId, categoria)?.find(
    (g) => g.gironeId === gironeId,
  );
  if (!girone) return { ok: false, motivo: "nonTrovato" };
  const parita = paritaPerfette(
    girone.giocatori.map((g) => g.iscrizioneId),
    girone.partite,
  ).find((p) => p.firma === firma);
  if (!parita) return { ok: false, motivo: "conflict" };
  if (!ordineValido(ordine, parita.iscrizioni)) {
    return { ok: false, motivo: "ordineNonValido" };
  }

  const nomi = new Map(girone.giocatori.map((g) => [g.iscrizioneId, g.nome]));
  const nomiDi = (ids: readonly string[]) =>
    ids.map((id) => nomi.get(id) ?? id);
  const decisioni = store().get(gironeId) ?? [];
  const prima = decisioni.find((d) => d.firma === firma);
  store().set(gironeId, [
    ...decisioni.filter((d) => d.firma !== firma),
    { firma, ordine: [...ordine], motivo },
  ]);
  aggiungiVoceDemoRegistro(tappaId, {
    tipo: "parita_risolta",
    autore: AUTORE_DEMO,
    prima: prima
      ? { ordine: nomiDi(prima.ordine), motivo: prima.motivo }
      : null,
    dopo: { girone: girone.gironeNome, firma, ordine: nomiDi(ordine) },
    nota: motivo.slice(0, 500),
  });
  return {
    ok: true,
    dati: getDemoDatiParita(tappaId, categoria)!.find(
      (g) => g.gironeId === gironeId,
    )!,
  };
}

/**
 * A stage in progress for one e2e test, whose men's «Girone A» is over
 * with a perfect three-way tie for 2nd place: player A wins all three
 * matches 21–19, so B, C and D have one win, the same head-to-head, the
 * same difference and the same points. The editor shows the same groups.
 * Only reachable through `POST /api/demo/parita`.
 */
export function creaDemoParita(): {
  id: string;
  categoria: Categoria;
  gironeId: string;
} {
  const id = creaDemoAvvioFase("pronta");
  avviaFaseDemo(id, "M");
  const tabellone = getDemoAvvioFase(id, "M")!;
  const girone = tabellone.gironi[0];
  const partite = getDemoTabelloneLive(id, "M", now())!.partite.filter(
    (p) => p.gironeId === girone.id,
  );
  for (const p of partite) {
    cambiaStatoDemo(id, "M", p.id, "inizia");
    salvaPunteggioDemo(id, "M", p.id, p.versione, [{ a: 21, b: 19 }], true);
  }
  sostituisciDemoGironi(id, "M", (attuale) => ({
    ...attuale,
    bloccata: true,
    gironi: tabellone.gironi.map((g, i) => ({
      id: g.id,
      nome: g.nome,
      posizione: i + 1,
      fase: attuale.fase,
      giocatori: g.giocatori.map((p) => ({
        iscrizioneId: p.iscrizioneId,
        nome: `${p.nome} ${p.cognome}`.trim(),
      })),
    })),
    nonAssegnati: [],
  }));
  return { id, categoria: "M", gironeId: girone.id };
}
