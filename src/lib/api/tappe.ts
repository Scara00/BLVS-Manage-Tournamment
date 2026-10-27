import { BodyReader } from "./validation";
import { STATI_TAPPA } from "@/lib/db/types";

export const TAPPA_COLUMNS =
  "id, nome, luogo, data_inizio, data_fine, stato, iscrizioni_aprono_il, iscrizioni_chiudono_il, created_at, updated_at, tabelloni (id, categoria)";

/** Reads the writable fields of a stage; `partial` for PATCH. */
export function readTappa(body: Record<string, unknown>, partial: boolean) {
  const reader = new BodyReader(body);
  const required = !partial;
  const values = reader.pick({
    nome:
      partial && !reader.has("nome")
        ? undefined
        : reader.text("nome", { max: 120 }),
    luogo:
      partial && !reader.has("luogo")
        ? undefined
        : reader.text("luogo", { max: 200 }),
    data_inizio:
      partial && !reader.has("dataInizio")
        ? undefined
        : reader.date("dataInizio", { required }),
    data_fine:
      partial && !reader.has("dataFine")
        ? undefined
        : reader.date("dataFine", { required }),
    stato: reader.oneOf("stato", STATI_TAPPA, { required: false }),
    iscrizioni_aprono_il: reader.timestamp("iscrizioniApronoIl"),
    iscrizioni_chiudono_il: reader.timestamp("iscrizioniChiudonoIl"),
  });
  if (
    values.data_inizio &&
    values.data_fine &&
    values.data_fine < values.data_inizio
  ) {
    reader.errors.dataFine ??= "La fine non può precedere l'inizio.";
  }
  if (partial && reader.ok && Object.keys(values).length === 0) {
    reader.errors._ = "Nessun campo da aggiornare.";
  }
  return { reader, values };
}
