import { BodyReader } from "@/lib/api/validation";
import type { Categoria } from "@/lib/db/types";
import {
  NUOVA_TAPPA_MESSAGES,
  POSTI_MAX,
  POSTI_MIN,
} from "@/lib/tappe/nuova/types";
import {
  romeLocalToDate,
  romeStartOfDay,
  romeToday,
} from "@/lib/time/rome-local";
import { now } from "@/lib/time/server-time";
import {
  CAMPI_TAPPA_MODIFICA,
  CAMPO_POSTI_MODIFICA,
  TAPPA_MODIFICA_MESSAGES as M,
  maxSottoIscrittiMessage,
  type TappaModifica,
  type TappaModificaFieldErrors,
  type TappaModificaValori,
} from "./types";

export type TappaModificaValidation =
  | { ok: true; values: TappaModificaValori }
  | { ok: false; fields: TappaModificaFieldErrors };

/**
 * The error for one board's maximum, or `undefined` when it is fine. The
 * floor is the larger of `POSTI_MIN` and the board's active registrations;
 * the client runs this on every change, the server before saving, and the
 * trigger `tabelloni_posti_minimo` is the final guard.
 */
export function errorePosti(raw: string, iscritti: number): string | undefined {
  const value = raw.trim();
  if (value === "") return "Campo obbligatorio.";
  const posti = Number(value);
  if (!/^\d+$/.test(value) || posti > POSTI_MAX)
    return NUOVA_TAPPA_MESSAGES.posti;
  if (posti < iscritti) return maxSottoIscrittiMessage(iscritti);
  if (posti < POSTI_MIN) return NUOVA_TAPPA_MESSAGES.posti;
  return undefined;
}

function readForm(formData: FormData): Record<string, unknown> {
  const body: Record<string, unknown> = {};
  for (const campo of CAMPI_TAPPA_MODIFICA) {
    const value = formData.get(campo);
    if (typeof value === "string") body[campo] = value;
  }
  return body;
}

/**
 * Validates w-admin-tappa-modifica against the stage as saved
 * (`originale`). Same rules as «Nuova tappa», except that a day of play or
 * a deadline already in the past stays valid until it is changed, and a
 * board's maximum may not drop below its active registrations. The
 * `modifica_tappa` RPC checks the same rules.
 */
export function validaTappaModifica(
  formData: FormData,
  originale: TappaModifica,
  adesso: Date = now(),
): TappaModificaValidation {
  const reader = new BodyReader(readForm(formData));
  const nome = reader.text("nome", { max: 120 });
  const luogo = reader.text("luogo", { max: 200 });

  const data = reader.text("data", { max: 10 });
  const inizio = data === undefined ? undefined : romeStartOfDay(data);
  if (data !== undefined) {
    if (!inizio) reader.errors.data ??= M.dataNonValida;
    else if (data !== originale.data && data <= romeToday(adesso)) {
      reader.errors.data ??= M.dataPassata;
    }
  }

  const scadenzaRaw = reader.text("scadenza", { max: 16 });
  let scadenza: Date | null | undefined;
  if (scadenzaRaw !== undefined) {
    scadenza = romeLocalToDate(scadenzaRaw);
    if (!scadenza) {
      // A well-formed time on a real day can only be missing because the
      // clocks skipped it (start of summer time).
      const benFormata =
        /^\d{4}-\d{2}-\d{2}T([01]\d|2[0-3]):[0-5]\d$/.test(scadenzaRaw) &&
        romeStartOfDay(scadenzaRaw.slice(0, 10)) !== null;
      reader.errors.scadenza ??= benFormata
        ? M.oraInesistente
        : M.scadenzaNonValida;
    } else if (scadenzaRaw !== originale.scadenza && scadenza <= adesso) {
      reader.errors.scadenza ??= M.scadenzaPassata;
    } else if (inizio && scadenza >= inizio) {
      reader.errors.scadenza ??= M.scadenzaDopoTappa;
    }
  }

  const posti = {} as Record<Categoria, number>;
  for (const categoria of ["M", "F"] as const) {
    const campo = CAMPO_POSTI_MODIFICA[categoria];
    const raw =
      typeof formData.get(campo) === "string"
        ? (formData.get(campo) as string)
        : "";
    const errore = errorePosti(raw, originale.tabelloni[categoria].iscritti);
    if (errore) reader.errors[campo] ??= errore;
    else posti[categoria] = Number(raw.trim());
  }

  if (!reader.ok) return { ok: false, fields: reader.errors };
  return {
    ok: true,
    values: {
      nome: nome!,
      luogo: luogo!,
      data: data!,
      scadenza: scadenza!.toISOString(),
      postiM: posti.M,
      postiF: posti.F,
    },
  };
}
