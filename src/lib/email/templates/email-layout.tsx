import type { ReactNode } from "react";
import {
  Body,
  Container,
  Head,
  Hr,
  Html,
  Preview,
  Section,
  Text,
} from "react-email";
import { color } from "@/lib/design-tokens/tokens";

/**
 * Inline styles only: email clients drop <style> blocks and web fonts, so the
 * BLVS Court tokens are applied by hand with system-font fallbacks.
 */
export const emailStyles = {
  body: {
    margin: 0,
    padding: "24px 0",
    backgroundColor: color.neutral[100],
    color: color.foreground,
    fontFamily: "Figtree, Helvetica, Arial, sans-serif",
    fontSize: "16px",
    lineHeight: "24px",
  },
  container: {
    maxWidth: "560px",
    margin: "0 auto",
    backgroundColor: color.background,
  },
  header: {
    backgroundColor: color.primary,
    padding: "16px 24px",
  },
  brand: {
    margin: 0,
    color: color.primaryForeground,
    fontFamily: "Outfit, Helvetica, Arial, sans-serif",
    fontSize: "20px",
    fontWeight: 700,
    letterSpacing: "0.04em",
  },
  tape: { backgroundColor: color.tape, height: "6px", lineHeight: "6px" },
  content: { padding: "24px" },
  heading: {
    margin: "0 0 16px",
    color: color.primary,
    fontFamily: "Outfit, Helvetica, Arial, sans-serif",
    fontSize: "24px",
    lineHeight: "32px",
    fontWeight: 700,
  },
  text: {
    margin: "0 0 16px",
    color: color.foreground,
    fontSize: "16px",
    lineHeight: "24px",
  },
  /** Black on tape yellow: the only allowed text-on-yellow pairing. */
  button: {
    display: "inline-block",
    padding: "12px 24px",
    backgroundColor: color.tape,
    color: color.primary,
    fontWeight: 700,
    textDecoration: "none",
  },
  link: { color: color.primary, textDecoration: "underline" },
  hr: { borderColor: color.border, margin: "24px 0" },
  footer: {
    margin: 0,
    color: color.mutedForeground,
    fontSize: "14px",
    lineHeight: "20px",
  },
} as const;

type EmailLayoutProps = {
  /** Inbox preview line (hidden text at the top of the body). */
  preview: string;
  /** Why the recipient got the email, shown in the footer. */
  footer?: string;
  children: ReactNode;
};

const DEFAULT_FOOTER =
  "Hai ricevuto questa email perché qualcuno ha usato il tuo indirizzo su BLVS. Se non hai richiesto nulla, ignora questo messaggio.";

/** Shared shell of every BLVS email: `<html lang="it">`, header, footer. */
export function EmailLayout({
  preview,
  footer = DEFAULT_FOOTER,
  children,
}: EmailLayoutProps) {
  return (
    <Html lang="it" dir="ltr">
      <Head />
      <Preview>{preview}</Preview>
      <Body lang="it" style={emailStyles.body}>
        <Container style={emailStyles.container}>
          <Section style={emailStyles.header}>
            <Text style={emailStyles.brand}>BLVS · Beach Life Volley Soul</Text>
          </Section>
          <Section data-skip-in-text="true" style={emailStyles.tape}>
            &nbsp;
          </Section>
          <Section style={emailStyles.content}>
            {children}
            <Hr style={emailStyles.hr} />
            <Text style={emailStyles.footer}>{footer}</Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}
