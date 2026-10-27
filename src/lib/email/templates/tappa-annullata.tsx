import { Heading, Text } from "react-email";
import { formatServerTime } from "@/lib/time/server-time";
import { EmailAction } from "./email-action";
import { EmailLayout, emailStyles } from "./email-layout";

export type TappaAnnullataProps = {
  /** Name of the tour stage, e.g. "Tappa di Rimini". */
  stageName: string;
  /**
   * ISO date-time of the stage, shown in Europe/Rome; or a calendar day
   * `YYYY-MM-DD` (the `tappe.data_inizio` column), shown without a time.
   */
  startsAt: string;
  location?: string;
  /** Optional reason given by the organisers. */
  reason?: string;
  /** Page with the details of the cancellation and any refund. */
  detailsUrl: string;
};

const CALENDAR_DAY = /^\d{4}-\d{2}-\d{2}$/;

// A `date` column is a calendar day: format it in UTC so no zone shifts it.
const calendarDay = new Intl.DateTimeFormat("it-IT", {
  dateStyle: "full",
  timeZone: "UTC",
});

function formatStartsAt(startsAt: string) {
  if (CALENDAR_DAY.test(startsAt)) {
    return calendarDay.format(new Date(`${startsAt}T00:00:00Z`));
  }
  return formatServerTime(new Date(startsAt), {
    dateStyle: "full",
    timeStyle: "short",
  });
}

export function tappaAnnullataSubject({ stageName }: TappaAnnullataProps) {
  return `Tappa annullata: ${stageName} · BLVS`;
}

export function TappaAnnullata({
  stageName,
  startsAt,
  location,
  reason,
  detailsUrl,
}: TappaAnnullataProps) {
  const when = formatStartsAt(startsAt);
  return (
    <EmailLayout
      preview={`La tappa ${stageName} è stata annullata`}
      footer="Hai ricevuto questa email perché avevi un’iscrizione a questa tappa su BLVS."
    >
      <Heading as="h1" style={emailStyles.heading}>
        Tappa annullata
      </Heading>
      <Text style={emailStyles.text}>
        Ci dispiace: la tappa <strong>{stageName}</strong> prevista per {when}
        {location ? ` a ${location}` : ""} è stata annullata.
      </Text>
      {reason ? <Text style={emailStyles.text}>Motivo: {reason}</Text> : null}
      <Text style={emailStyles.text}>
        Trovi i dettagli dell&apos;annullamento e le informazioni sulla tua
        iscrizione nella pagina della tappa.
      </Text>
      <EmailAction href={detailsUrl} label="Vedi i dettagli" />
    </EmailLayout>
  );
}
