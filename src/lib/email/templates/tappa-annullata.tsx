import { Heading, Text } from "react-email";
import { formatServerTime } from "@/lib/time/server-time";
import { EmailAction } from "./email-action";
import { EmailLayout, emailStyles } from "./email-layout";

export type TappaAnnullataProps = {
  /** Name of the tour stage, e.g. "Tappa di Rimini". */
  stageName: string;
  /** ISO date-time of the stage; shown in Europe/Rome. */
  startsAt: string;
  location?: string;
  /** Optional reason given by the organisers. */
  reason?: string;
  /** Page with the details of the cancellation and any refund. */
  detailsUrl: string;
};

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
  const when = formatServerTime(new Date(startsAt), {
    dateStyle: "full",
    timeStyle: "short",
  });
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
