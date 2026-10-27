import { Heading, Text } from "react-email";
import { EmailAction } from "./email-action";
import { EmailLayout, emailStyles } from "./email-layout";

export type ConfermaEmailProps = {
  confirmationUrl: string;
};

export const confermaEmailSubject = "Conferma il tuo indirizzo email · BLVS";

export function ConfermaEmail({ confirmationUrl }: ConfermaEmailProps) {
  return (
    <EmailLayout preview="Conferma il tuo indirizzo email per attivare l'account BLVS">
      <Heading as="h1" style={emailStyles.heading}>
        Conferma il tuo indirizzo email
      </Heading>
      <Text style={emailStyles.text}>
        Ti diamo il benvenuto su BLVS! Per attivare l&apos;account e iscriverti
        alle tappe, conferma che questo indirizzo è tuo.
      </Text>
      <EmailAction href={confirmationUrl} label="Conferma email" />
    </EmailLayout>
  );
}
