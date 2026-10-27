import { now as oraServer } from "@/lib/time/server-time";
import {
  annuncioCambio,
  nuovaVoce,
  sostituite,
  tieniIlMio as tieniIlMioVoce,
} from "./coda";
import { creaInviatore, prossimoRisveglio } from "./invio";
import type { CodaStore } from "./store";
import type { InviaPunteggio, NuovoPunteggio, VoceCoda } from "./types";

/** Tabs tell each other the queue changed, so every list stays current. */
export const CODA_CANALE = "blvs:coda-punteggi";

export type StatoCoda = {
  /** The device queue; `null` until it has been read. */
  voci: VoceCoda[] | null;
  /** Last text for the status region. */
  annuncio: string;
};

export const STATO_INIZIALE: StatoCoda = { voci: null, annuncio: "" };

export type CodaOptions = {
  store: CodaStore;
  invia: InviaPunteggio;
  /** The admin signed in on this device now, read locally. */
  leggiAutore: () => Promise<string | null>;
  now?: () => Date;
  online?: () => boolean;
};

export type Coda = ReturnType<typeof creaCoda>;

/**
 * The score queue of one page (BLVS-33), outside React: the provider reads
 * it with `useSyncExternalStore`. `avvia()` hooks it to the browser
 * (network back, tab visible again, other tabs, retry timer) and sends
 * what is due; it returns the cleanup.
 */
export function creaCoda({
  store,
  invia,
  leggiAutore,
  now = oraServer,
  online = () => typeof navigator === "undefined" || navigator.onLine,
}: CodaOptions) {
  let stato = STATO_INIZIALE;
  let autore: Promise<string | null> | null = null;
  let autoreAttuale: string | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let canale: BroadcastChannel | null = null;
  const ascoltatori = new Set<() => void>();

  function aggiorna(parziale: Partial<StatoCoda>) {
    stato = { ...stato, ...parziale };
    for (const fn of ascoltatori) fn();
  }

  function annuncia(testo: string | null) {
    if (testo) aggiorna({ annuncio: testo });
  }

  function autoreCorrente() {
    autore = leggiAutore().then((id) => {
      autoreAttuale = id;
      return id;
    });
    return autore;
  }

  async function ricarica() {
    const voci = await store.leggi();
    aggiorna({ voci });
    if (timer) clearTimeout(timer);
    timer = null;
    const risveglio = prossimoRisveglio(voci);
    if (risveglio) {
      timer = setTimeout(
        () => void svuota(false),
        Math.max(0, risveglio.getTime() - now().getTime()),
      );
    }
    return voci;
  }

  function cambiato() {
    void ricarica();
    canale?.postMessage("cambio");
  }

  const inviatore = creaInviatore({
    store,
    invia,
    autoreId: () => autoreAttuale,
    now,
    onCambio(prima, dopo) {
      annuncia(annuncioCambio(prima, dopo));
      cambiato();
    },
  });

  async function svuota(forza: boolean) {
    if (!online()) return;
    if (forza || !autore) await autoreCorrente();
    await inviatore.svuota(forza);
    await ricarica();
  }

  async function trova(chiave: string) {
    return (await store.leggi()).find((v) => v.chiave === chiave);
  }

  return {
    subscribe(fn: () => void) {
      ascoltatori.add(fn);
      return () => void ascoltatori.delete(fn);
    },
    getSnapshot: () => stato,
    svuota,

    avvia() {
      const riprendi = () => void svuota(true);
      const visibile = () => {
        if (document.visibilityState === "visible") riprendi();
      };
      window.addEventListener("online", riprendi);
      document.addEventListener("visibilitychange", visibile);
      if (typeof BroadcastChannel !== "undefined") {
        canale = new BroadcastChannel(CODA_CANALE);
        canale.onmessage = () => void ricarica();
      }
      void ricarica().then(riprendi);
      return () => {
        window.removeEventListener("online", riprendi);
        document.removeEventListener("visibilitychange", visibile);
        canale?.close();
        canale = null;
        if (timer) clearTimeout(timer);
        timer = null;
      };
    },

    /**
     * Queues a score and sends it at once if there is network. The score
     * is on the device before this resolves.
     */
    async accoda(input: NuovoPunteggio): Promise<VoceCoda> {
      const autoreId = await (autore ?? autoreCorrente());
      const voce = nuovaVoce(input, { autoreId, now: now() });
      for (const vecchia of sostituite(await store.leggi(), voce)) {
        await store.elimina(vecchia.chiave);
      }
      await store.scrivi(voce);
      if (!online()) annuncia(annuncioCambio(undefined, voce));
      cambiato();
      void svuota(false);
      return voce;
    },

    async tieniIlMio(chiave: string) {
      const voce = await trova(chiave);
      const nuova = voce && tieniIlMioVoce(voce, now());
      if (!nuova) return;
      await store.elimina(chiave);
      await store.scrivi(nuova);
      cambiato();
      void svuota(true);
    },

    async tieniQuelloSalvato(chiave: string) {
      const voce = await trova(chiave);
      await store.elimina(chiave);
      if (voce) annuncia(`${voce.etichetta}: tenuto il punteggio salvato.`);
      cambiato();
    },

    async togli(chiave: string) {
      await store.elimina(chiave);
      cambiato();
    },
  };
}
