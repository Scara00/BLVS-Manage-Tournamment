import type { Categoria } from "@/lib/db/types";
import type { FasiTabelloni, LiveMe } from "@/lib/live/tappa";
import type { LiveSync, OverallPlayerRow } from "@/lib/live/types";
import type { TappaGiocatore } from "@/lib/tappe/format";
import type { IscrizioneHome } from "./vista";

/** w-home on the race day: the stage's live data and my overall place. */
export type HomeGara = {
  tipo: "gara";
  tappa: { id: string; nome: string };
  sync: LiveSync;
  me: LiveMe;
  fasi: FasiTabelloni;
  categoria: Categoria | null;
  /** My row of the overall standing (stage season), if I am in it. */
  generale: OverallPlayerRow | null;
};

/** w-home on any other day. */
export type HomeProssima = {
  tipo: "prossima";
  tappa: TappaGiocatore;
  iscrizione: IscrizioneHome | null;
};

export type VistaHome = HomeGara | HomeProssima | { tipo: "vuota" };

export type Home =
  | { status: "sessionExpired" }
  | { status: "ok"; nome: string | null; vista: VistaHome };
