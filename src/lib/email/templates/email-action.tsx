import { Button, Link, Section, Text } from "react-email";
import { emailStyles } from "./email-layout";

type EmailActionProps = {
  href: string;
  label: string;
};

/**
 * The call-to-action button, followed by the same address as plain text for
 * clients that block buttons (and for the text-only version).
 */
export function EmailAction({ href, label }: EmailActionProps) {
  return (
    <Section>
      <Text style={emailStyles.text}>
        {/* The text-only version keeps just the spelled-out link below. */}
        <Button href={href} data-skip-in-text="true" style={emailStyles.button}>
          {label}
        </Button>
      </Text>
      <Text style={emailStyles.text}>
        Se il pulsante non funziona, copia e incolla questo indirizzo nel
        browser:{" "}
        <Link href={href} style={emailStyles.link}>
          {href}
        </Link>
      </Text>
    </Section>
  );
}
