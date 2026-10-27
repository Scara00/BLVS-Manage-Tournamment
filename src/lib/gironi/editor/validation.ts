import {
  NON_ASSEGNATI,
  type ModificaGironiInput,
  type OperazioneGironi,
} from "./types";

const testo = (v: unknown): v is string =>
  typeof v === "string" && v.length > 0 && v.length <= 100;

function operazione(v: unknown): OperazioneGironi | null {
  if (typeof v !== "object" || v === null) return null;
  const o = v as Record<string, unknown>;
  switch (o.tipo) {
    case "sposta":
      return testo(o.iscrizioneId) && testo(o.verso)
        ? { tipo: "sposta", iscrizioneId: o.iscrizioneId, verso: o.verso }
        : null;
    case "scambia":
      return testo(o.a) && testo(o.b) && o.a !== o.b
        ? { tipo: "scambia", a: o.a, b: o.b }
        : null;
    case "aggiungi":
      if (o.fase === undefined) return { tipo: "aggiungi" };
      return o.fase === "iniziale" || o.fase === "gold" || o.fase === "silver"
        ? { tipo: "aggiungi", fase: o.fase }
        : null;
    case "elimina":
      return testo(o.gironeId) && o.gironeId !== NON_ASSEGNATI
        ? { tipo: "elimina", gironeId: o.gironeId }
        : null;
    default:
      return null;
  }
}

/** The action input, checked: it comes from the client. */
export function leggiModificaGironi(v: unknown): ModificaGironiInput | null {
  if (typeof v !== "object" || v === null) return null;
  const o = v as Record<string, unknown>;
  const op = operazione(o.operazione);
  if (
    !testo(o.tappaId) ||
    (o.categoria !== "M" && o.categoria !== "F") ||
    !Number.isInteger(o.versione) ||
    (o.versione as number) < 0 ||
    !op
  ) {
    return null;
  }
  return {
    tappaId: o.tappaId,
    categoria: o.categoria,
    versione: o.versione as number,
    operazione: op,
  };
}
