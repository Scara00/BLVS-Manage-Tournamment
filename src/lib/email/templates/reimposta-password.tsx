import { Heading, Text } from "react-email";
import { EmailAction } from "./email-action";
import { EmailLayout, emailStyles } from "./email-layout";

export type ReimpostaPasswordProps = {
  resetUrl: string;
  /** How long the link stays valid (Supabase Auth default: 60 minutes). */
  validityMinutes?: number;
};

export const reimpostaPasswordSubject = "Reimposta la password · BLVS";

export function ReimpostaPassword({
  resetUrl,
  validityMinutes = 60,
}: ReimpostaPasswordProps) {
  return (
    <EmailLayout preview="Hai chiesto di reimpostare la password del tuo account BLVS">
      <Heading as="h1" style={emailStyles.heading}>
        Reimposta la password
      </Heading>
      <Text style={emailStyles.text}>
        Abbiamo ricevuto una richiesta di reimpostazione della password per il
        tuo account BLVS. Il link è valido per {validityMinutes} minuti e si può
        usare una sola volta.
      </Text>
      <EmailAction href={resetUrl} label="Scegli una nuova password" />
      <Text style={emailStyles.text}>
        Se non hai chiesto tu di cambiare la password, ignora questa email: la
        password attuale resta valida.
      </Text>
    </EmailLayout>
  );
}
