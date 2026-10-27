import type { Categoria } from "@/lib/db/types";

/** A registration drawn out of the groups (row of `esclusi`). */
export type IscrittoEscluso = {
  iscrizione_id: string;
  utente_id: string;
  nome: string;
  cognome: string;
  posto: number | null;
};

/** One row of RPC `genera_gironi()`: the outcome for one board. */
export type GironiGenerati = {
  categoria: Categoria;
  gironi: number;
  partite: number;
  esclusi: IscrittoEscluso[];
};
