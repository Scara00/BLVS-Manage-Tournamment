import type { SupabaseClient } from "@supabase/supabase-js";
import {
  renderEmail,
  type EmailTemplateName,
  type EmailTemplateProps,
} from "./render";

export type EmailAccodata = { id: string };

export class ErroreCodaEmail extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ErroreCodaEmail";
  }
}

/**
 * Renders an email and puts it in `public.coda_email`. Nothing is sent here:
 * the `send-emails` Edge Function picks it up within a minute, retries on
 * errors and, in development and CI, delivers it to Mailpit only.
 *
 * `client` must use the secret key (`getSupabaseAdmin()`): the queue is not
 * reachable with a user session.
 */
export async function accodaEmail<N extends EmailTemplateName>(
  client: SupabaseClient,
  {
    to,
    template,
    props,
    maxTentativi,
  }: {
    to: string;
    template: N;
    props: EmailTemplateProps[N];
    maxTentativi?: number;
  },
): Promise<EmailAccodata> {
  const email = await renderEmail(template, props);
  const { data, error } = await client
    .from("coda_email")
    .insert({
      destinatario: to,
      modello: template,
      oggetto: email.subject,
      html: email.html,
      testo: email.text,
      ...(maxTentativi ? { max_tentativi: maxTentativi } : {}),
    })
    .select("id")
    .single<EmailAccodata>();

  if (error || !data) {
    console.error("[email] accodamento non riuscito", template, error);
    throw new ErroreCodaEmail("Non è stato possibile accodare l'email.");
  }
  return data;
}
