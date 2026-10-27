import { Heading, Text } from "react-email";
import { EmailAction } from "./email-action";
import { EmailLayout, emailStyles } from "./email-layout";

export type ConfermaNuovaEmailProps = {
  confirmationUrl: string;
  /** Address in use now. */
  currentEmail: string;
  /** Address the player asked to switch to. */
  newEmail: string;
};

export const confermaNuovaEmailSubject =
  "Conferma il cambio di indirizzo email · BLVS";

/**
 * Sent by Supabase Auth to both the current and the new address
 * (`double_confirm_changes`): the change applies once both links are opened.
 */
export function ConfermaNuovaEmail({
  confirmationUrl,
  currentEmail,
  newEmail,
}: ConfermaNuovaEmailProps) {
  return (
    <EmailLayout preview="Conferma il cambio di indirizzo email del tuo account BLVS">
      <Heading as="h1" style={emailStyles.heading}>
        Conferma il cambio di indirizzo email
      </Heading>
      <Text style={emailStyles.text}>
        Hai chiesto di cambiare l&apos;indirizzo email del tuo account BLVS da{" "}
        {currentEmail} a {newEmail}. Abbiamo inviato un link a entrambi gli
        indirizzi: il cambio vale solo dopo che li hai aperti tutti e due.
      </Text>
      <EmailAction href={confirmationUrl} label="Conferma il cambio" />
      <Text style={emailStyles.text}>
        Se non hai chiesto tu di cambiare indirizzo, ignora questa email:
        l&apos;indirizzo attuale resta valido.
      </Text>
    </EmailLayout>
  );
}
