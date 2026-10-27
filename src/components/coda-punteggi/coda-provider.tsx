"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { inviaPunteggioCoda } from "@/lib/punteggi/coda/actions";
import { ultimaPerPartita } from "@/lib/punteggi/coda/coda";
import {
  creaCoda,
  STATO_INIZIALE,
  type Coda,
} from "@/lib/punteggi/coda/controller";
import { storeDelDispositivo, type CodaStore } from "@/lib/punteggi/coda/store";
import type {
  InviaPunteggio,
  NuovoPunteggio,
  VoceCoda,
} from "@/lib/punteggi/coda/types";
import { createClient } from "@/lib/supabase/client";

/** Author of the scores entered in the demo (no Supabase env). */
export const AUTORE_DEMO = "demo";

export type CodaPunteggi = {
  /** The device queue; `null` while it is being read. */
  voci: VoceCoda[] | null;
  /**
   * Queues a score and sends it at once if there is network. The score is
   * on the device before this resolves: it survives a reload, a lost
   * connection and the end of the session.
   */
  accoda(input: NuovoPunteggio): Promise<VoceCoda>;
  /** The newest entry of a match, to show its state next to it. */
  statoPartita(partitaId: string): VoceCoda | undefined;
  tieniIlMio(chiave: string): Promise<void>;
  tieniQuelloSalvato(chiave: string): Promise<void>;
  togli(chiave: string): Promise<void>;
};

const Context = createContext<Coda | null>(null);

/** The device queue and its actions; use inside the admin area. */
export function useCodaPunteggi(): CodaPunteggi {
  const coda = useContext(Context);
  if (!coda)
    throw new Error("useCodaPunteggi va usato dentro <CodaPunteggiProvider>");
  const { voci } = useSyncExternalStore(
    coda.subscribe,
    coda.getSnapshot,
    () => STATO_INIZIALE,
  );
  return {
    voci,
    accoda: coda.accoda,
    statoPartita: (partitaId) => ultimaPerPartita(voci ?? [], partitaId),
    tieniIlMio: coda.tieniIlMio,
    tieniQuelloSalvato: coda.tieniQuelloSalvato,
    togli: coda.togli,
  };
}

/** The admin signed in on this device, read locally (works offline). */
async function autoreDellaSessione(): Promise<string | null> {
  try {
    const { data } = await createClient().auth.getSession();
    return data.session?.user.id ?? null;
  } catch {
    return null;
  }
}

function Annuncio({ coda }: { coda: Coda }) {
  const { annuncio } = useSyncExternalStore(
    coda.subscribe,
    coda.getSnapshot,
    () => STATO_INIZIALE,
  );
  return (
    <p role="status" className="sr-only" data-slot="coda-punteggi-annuncio">
      {annuncio}
    </p>
  );
}

/**
 * Mounted once by the admin layout (BLVS-33): keeps the score queue in
 * IndexedDB and sends it on its own when the page opens, the network
 * comes back, the tab becomes visible again or a retry is due. After the
 * session closes the scores stay on the device and leave after the same
 * admin signs in again (the layout mounts again on the return page).
 * One `role=status` region announces each change of state.
 */
export function CodaPunteggiProvider({
  children,
  enforced,
  invia = inviaPunteggioCoda,
  store,
}: {
  children: ReactNode;
  /** Supabase env set: the author is the signed-in admin. */
  enforced: boolean;
  invia?: InviaPunteggio;
  store?: CodaStore;
}) {
  const [coda] = useState(() =>
    creaCoda({
      store: store ?? storeDelDispositivo(),
      invia,
      leggiAutore: enforced
        ? autoreDellaSessione
        : () => Promise.resolve(AUTORE_DEMO),
    }),
  );

  useEffect(() => coda.avvia(), [coda]);

  return (
    <Context value={coda}>
      {children}
      <Annuncio coda={coda} />
    </Context>
  );
}
