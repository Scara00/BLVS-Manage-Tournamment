import { render } from "@react-email/render";
import type { ReactElement } from "react";
import {
  ConfermaEmail,
  confermaEmailSubject,
  type ConfermaEmailProps,
} from "./templates/conferma-email";
import {
  ReimpostaPassword,
  reimpostaPasswordSubject,
  type ReimpostaPasswordProps,
} from "./templates/reimposta-password";
import {
  TappaAnnullata,
  tappaAnnullataSubject,
  type TappaAnnullataProps,
} from "./templates/tappa-annullata";

/** Props of each email template, by template name. */
export type EmailTemplateProps = {
  "conferma-email": ConfermaEmailProps;
  "reimposta-password": ReimpostaPasswordProps;
  "tappa-annullata": TappaAnnullataProps;
};

export type EmailTemplateName = keyof EmailTemplateProps;

type TemplateDefinition<P> = {
  subject: (props: P) => string;
  element: (props: P) => ReactElement;
};

export const emailTemplates: {
  [N in EmailTemplateName]: TemplateDefinition<EmailTemplateProps[N]>;
} = {
  "conferma-email": {
    subject: () => confermaEmailSubject,
    element: (props) => <ConfermaEmail {...props} />,
  },
  "reimposta-password": {
    subject: () => reimpostaPasswordSubject,
    element: (props) => <ReimpostaPassword {...props} />,
  },
  "tappa-annullata": {
    subject: tappaAnnullataSubject,
    element: (props) => <TappaAnnullata {...props} />,
  },
};

export type RenderedEmail = {
  subject: string;
  /** Full HTML document, `<html lang="it">`, inline styles. */
  html: string;
  /** Text-only alternative of the same content, links spelled out. */
  text: string;
};

export function isEmailTemplateName(name: string): name is EmailTemplateName {
  return Object.hasOwn(emailTemplates, name);
}

/** Renders a template to subject + HTML + plain text. */
export async function renderEmail<N extends EmailTemplateName>(
  name: N,
  props: EmailTemplateProps[N],
): Promise<RenderedEmail> {
  const template = emailTemplates[name] as TemplateDefinition<
    EmailTemplateProps[N]
  >;
  const element = template.element(props);
  const [html, text] = await Promise.all([
    render(element),
    render(element, {
      plainText: true,
      // Headings stay in sentence case; the default upper-cases them.
      htmlToTextOptions: {
        selectors: [{ selector: "h1", options: { uppercase: false } }],
      },
    }),
  ]);
  return { subject: template.subject(props), html, text };
}
