import { applicaEsito, daInviare, riprendi, scaduti, seguitiDa } from "./coda";
import { now as oraServer } from "@/lib/time/server-time";
import type { CodaStore } from "./store";
import type { EsitoInvio, InviaPunteggio, VoceCoda } from "./types";

/** Web Lock shared by the tabs: one tab sends the queue at a time. */
export const CODA_LOCK = "blvs:coda-punteggi";

type LockManagerLike = {
  request<T>(
    name: string,
    options: { ifAvailable: boolean },
    callback: (lock: unknown) => Promise<T>,
  ): Promise<T>;
};

export type InviatoreOptions = {
  store: CodaStore;
  invia: InviaPunteggio;
  /** The admin signed in on this device now (`null` = unknown). */
  autoreId: () => string | null;
  now?: () => Date;
  random?: () => number;
  /** Called for every entry that changes, after it is written. */
  onCambio?: (prima: VoceCoda | undefined, dopo: VoceCoda) => void;
  locks?: LockManagerLike | null;
};

export type Inviatore = {
  /**
   * Sends what is due. `forza` (page opened, network back, signed in
   * again) also resumes entries a closed session stopped and skips the
   * retry wait. Calls while a run is going join it: never two sends at once.
   */
  svuota(forza?: boolean): Promise<void>;
};

const FERMA_TUTTO: ReadonlySet<EsitoInvio["status"]> = new Set([
  "sessionExpired",
  "altroAccount",
]);
const RIPROVA_DOPO: ReadonlySet<EsitoInvio["status"]> = new Set([
  "rete",
  "errore",
]);

function locksDelBrowser(): LockManagerLike | null {
  if (typeof navigator === "undefined") return null;
  return (navigator as { locks?: LockManagerLike }).locks ?? null;
}

export function creaInviatore({
  store,
  invia,
  autoreId,
  now = oraServer,
  random = Math.random,
  onCambio,
  locks = locksDelBrowser(),
}: InviatoreOptions): Inviatore {
  async function scrivi(prima: VoceCoda | undefined, dopo: VoceCoda) {
    await store.scrivi(dopo);
    onCambio?.(prima, dopo);
  }

  async function giro(forza: boolean) {
    const tutte = (await store.leggi()).map(riprendi);
    for (const vecchia of scaduti(tutte, now())) {
      await store.elimina(vecchia.chiave);
    }
    const lista = daInviare(tutte, {
      autoreId: autoreId(),
      now: now(),
      forza,
    });

    for (let i = 0; i < lista.length; i++) {
      // The page may have replaced or resolved it meanwhile.
      const attuale = (await store.leggi()).find(
        (v) => v.chiave === lista[i].chiave,
      );
      if (!attuale || attuale.stato === "salvato") continue;
      const inVolo: VoceCoda = { ...riprendi(attuale), stato: "invio" };
      await scrivi(attuale, inVolo);

      let esito: EsitoInvio;
      try {
        esito = await invia({
          chiave: inVolo.chiave,
          partitaId: inVolo.partitaId,
          versione: inVolo.versione,
          sets: inVolo.sets,
          autoreId: inVolo.autoreId,
        });
      } catch {
        esito = { status: "rete" };
      }
      const dopo = applicaEsito(inVolo, esito, { now: now(), random });
      await scrivi(inVolo, dopo);

      if (esito.status === "salvato") {
        for (const seguito of seguitiDa(
          await store.leggi(),
          dopo,
          inVolo.versione,
        )) {
          await store.scrivi(seguito);
        }
      }

      if (FERMA_TUTTO.has(esito.status) || RIPROVA_DOPO.has(esito.status)) {
        // The others would get the same answer: they wait with this one.
        for (const resto of lista.slice(i + 1)) {
          const corrente = (await store.leggi()).find(
            (v) => v.chiave === resto.chiave,
          );
          if (!corrente || corrente.stato === "salvato") continue;
          const fermo: VoceCoda = FERMA_TUTTO.has(esito.status)
            ? { ...corrente, stato: "sessione_chiusa", prossimoTentativo: null }
            : {
                ...riprendi(corrente),
                prossimoTentativo: dopo.prossimoTentativo,
              };
          await scrivi(corrente, fermo);
        }
        return;
      }
    }
  }

  async function conLock(forza: boolean) {
    if (!locks) return giro(forza);
    // Another tab holds it: that tab is sending, this one skips the run.
    await locks.request(CODA_LOCK, { ifAvailable: true }, async (lock) => {
      if (lock) await giro(forza);
    });
  }

  let corrente: Promise<void> | null = null;
  let ancora = false;
  let forzaAncora = false;

  return {
    svuota(forza = false) {
      if (corrente) {
        ancora = true;
        forzaAncora ||= forza;
        return corrente;
      }
      corrente = (async () => {
        try {
          let f = forza;
          do {
            ancora = false;
            await conLock(f);
            f = forzaAncora;
            forzaAncora = false;
          } while (ancora);
        } finally {
          corrente = null;
        }
      })();
      return corrente;
    },
  };
}

/** Earliest automatic retry among the entries, `null` when none is due. */
export function prossimoRisveglio(voci: readonly VoceCoda[]): Date | null {
  const tempi = voci
    .filter((v) => v.stato === "in_attesa" && v.prossimoTentativo)
    .map((v) => Date.parse(v.prossimoTentativo!));
  return tempi.length ? new Date(Math.min(...tempi)) : null;
}
