import type { VoceCoda } from "./types";

/** Where the queue lives: IndexedDB in the browser, memory in tests/stories. */
export interface CodaStore {
  leggi(): Promise<VoceCoda[]>;
  scrivi(voce: VoceCoda): Promise<void>;
  elimina(chiave: string): Promise<void>;
}

export const CODA_DB = "blvs-coda";
export const CODA_STORE = "punteggi";
const CODA_DB_VERSION = 1;

export function memoriaStore(iniziali: readonly VoceCoda[] = []): CodaStore {
  const voci = new Map(iniziali.map((v) => [v.chiave, v]));
  return {
    async leggi() {
      return [...voci.values()];
    },
    async scrivi(voce) {
      voci.set(voce.chiave, voce);
    },
    async elimina(chiave) {
      voci.delete(chiave);
    },
  };
}

function richiesta<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function apri(factory: IDBFactory): Promise<IDBDatabase> {
  const request = factory.open(CODA_DB, CODA_DB_VERSION);
  request.onupgradeneeded = () => {
    const db = request.result;
    if (!db.objectStoreNames.contains(CODA_STORE)) {
      const store = db.createObjectStore(CODA_STORE, { keyPath: "chiave" });
      store.createIndex("partitaId", "partitaId");
    }
  };
  return richiesta(request);
}

/**
 * The device queue in IndexedDB (database `blvs-coda`, store `punteggi`,
 * key `chiave`). It survives reloads, closed tabs and the session expiry.
 */
export function indexedDbStore(
  factory: IDBFactory = globalThis.indexedDB,
): CodaStore {
  let db: Promise<IDBDatabase> | null = null;
  const connessione = () => {
    db ??= apri(factory).catch((error) => {
      db = null;
      throw error;
    });
    return db;
  };

  async function transazione<T>(
    mode: IDBTransactionMode,
    fn: (store: IDBObjectStore) => IDBRequest<T>,
  ): Promise<T> {
    const tx = (await connessione()).transaction(CODA_STORE, mode);
    const result = richiesta(fn(tx.objectStore(CODA_STORE)));
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
    return result;
  }

  return {
    leggi: () =>
      transazione("readonly", (s) => s.getAll() as IDBRequest<VoceCoda[]>),
    scrivi: async (voce) => {
      await transazione("readwrite", (s) => s.put(voce));
    },
    elimina: async (chiave) => {
      await transazione("readwrite", (s) => s.delete(chiave));
    },
  };
}

/** IndexedDB when the browser has it, otherwise memory (SSR, old browsers). */
export function storeDelDispositivo(): CodaStore {
  return typeof indexedDB === "undefined" ? memoriaStore() : indexedDbStore();
}
