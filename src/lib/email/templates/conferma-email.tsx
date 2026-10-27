import { Heading, Text } from "react-email";
import { EmailAction } from "./email-action";
import { confermaEmailCopy } from "./conferma-email-copy";
import { EmailLayout, emailStyles } from "./email-layout";

export type ConfermaEmailProps = {
  confirmationUrl: string;
  /** How long the link stays valid (`otp_expiry` in supabase/config.toml). */
  validityMinutes?: number;
};

export { confermaEmailSubject } from "./conferma-email-copy";

export function ConfermaEmail({
  confirmationUrl,
  validityMinutes = 60,
}: ConfermaEmailProps) {
  return (
    <EmailLayout preview="Conferma il tuo indirizzo email per attivare l'account BLVS">
      <Heading as="h1" style={emailStyles.heading}>
        {confermaEmailCopy.heading}
      </Heading>
      <Text style={emailStyles.text}>{confermaEmailCopy.intro}</Text>
      <Text style={emailStyles.text}>
        {confermaEmailCopy.validity(validityMinutes)}
      </Text>
      <EmailAction href={confirmationUrl} label={confermaEmailCopy.action} />
    </EmailLayout>
  );
}
