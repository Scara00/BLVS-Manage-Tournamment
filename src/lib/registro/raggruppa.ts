import type { GiornoRegistro, VoceRegistroView } from "./types";

const giornoFormatter = new Intl.DateTimeFormat("it-IT", {
  weekday: "long",
  day: "numeric",
  month: "long",
  timeZone: "UTC",
});
const giornoAnnoFormatter = new Intl.DateTimeFormat("it-IT", {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

/** «YYYY-MM-DD» as noon UTC: no time zone can move it to another day. */
function aMezzogiorno(giorno: string): Date {
  return new Date(`${giorno}T12:00:00Z`);
}

function giornoPrima(giorno: string): string {
  const data = aMezzogiorno(giorno);
  data.setUTCDate(data.getUTCDate() - 1);
  return data.toISOString().slice(0, 10);
}

/**
 * «Oggi · sabato 12 giugno», «Ieri · venerdì 11 giugno», «giovedì 10
 * giugno»; the year is added when it is not the current one. Both days are
 * Rome days («YYYY-MM-DD»).
 */
export function etichettaGiorno(giorno: string, oggi: string): string {
  const formatter =
    giorno.slice(0, 4) === oggi.slice(0, 4)
      ? giornoFormatter
      : giornoAnnoFormatter;
  const data = formatter.format(aMezzogiorno(giorno));
  if (giorno === oggi) return `Oggi · ${data}`;
  if (giorno === giornoPrima(oggi)) return `Ieri · ${data}`;
  return data;
}

/**
 * Groups entries (already newest first) by their Rome day, keeping the
 * order of both days and entries.
 */
export function raggruppaPerGiorno(
  voci: readonly VoceRegistroView[],
  oggi: string,
): GiornoRegistro[] {
  const giorni: GiornoRegistro[] = [];
  for (const voce of voci) {
    const ultimo = giorni.at(-1);
    if (ultimo && ultimo.giorno === voce.giorno) {
      ultimo.voci.push(voce);
    } else {
      giorni.push({
        giorno: voce.giorno,
        etichetta: etichettaGiorno(voce.giorno, oggi),
        voci: [voce],
      });
    }
  }
  return giorni;
}
