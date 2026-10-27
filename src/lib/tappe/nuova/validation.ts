import { BodyReader } from "@/lib/api/validation";
import {
  romeLocalToDate,
  romeStartOfDay,
  romeToday,
} from "@/lib/time/rome-local";
import { now } from "@/lib/time/server-time";
import {
  CAMPI_NUOVA_TAPPA,
  NUOVA_TAPPA_MESSAGES as M,
  POSTI_MAX,
  POSTI_MIN,
  type CampoNuovaTappa,
  type NuovaTappaValori,
} from "./types";

export type NuovaTappaValidation =
  | { ok: true; values: NuovaTappaValori }
  | { ok: false; fields: Partial<Record<CampoNuovaTappa, string>> };

function posti(reader: BodyReader, raw: string | undefined, field: string) {
  if (raw === undefined) return undefined;
  const value = Number(raw);
  if (!/^\d+$/.test(raw) || value < POSTI_MIN || value > POSTI_MAX) {
    reader.errors[field] ??= M.posti;
    return undefined;
  }
  return value;
}

/**
 * Validates the «Nuova tappa» form. Dates are Europe/Rome: the day of play
 * must be after today, the deadline in the future and before midnight of
 * that day. A maximum with incomplete groups is only a warning (see
 * `gironi.ts`), never an error. The `crea_tappa` RPC checks the same rules.
 */
export function validaNuovaTappa(
  formData: FormData,
  adesso: Date = now(),
): NuovaTappaValidation {
  const body: Record<string, unknown> = {};
  for (const campo of CAMPI_NUOVA_TAPPA) {
    const value = formData.get(campo);
    if (typeof value === "string") body[campo] = value;
  }

  const reader = new BodyReader(body);
  const nome = reader.text("nome", { max: 120 });
  const luogo = reader.text("luogo", { max: 200 });

  const data = reader.text("data", { max: 10 });
  const inizio = data === undefined ? undefined : romeStartOfDay(data);
  if (data !== undefined) {
    if (!inizio) reader.errors.data ??= M.dataNonValida;
    else if (data <= romeToday(adesso)) reader.errors.data ??= M.dataPassata;
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
    } else if (scadenza <= adesso) {
      reader.errors.scadenza ??= M.scadenzaPassata;
    } else if (inizio && scadenza >= inizio) {
      reader.errors.scadenza ??= M.scadenzaDopoTappa;
    }
  }

  const postiM = posti(reader, reader.text("postiM", { max: 4 }), "postiM");
  const postiF = posti(reader, reader.text("postiF", { max: 4 }), "postiF");

  if (!reader.ok) return { ok: false, fields: reader.errors };
  return {
    ok: true,
    values: {
      nome: nome!,
      luogo: luogo!,
      data: data!,
      scadenza: scadenza!.toISOString(),
      postiM: postiM!,
      postiF: postiF!,
    },
  };
}
