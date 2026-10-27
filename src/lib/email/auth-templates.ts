import {
  CONFIRMATION_LINK_TTL_SECONDS,
  EMAIL_VERIFY_CALLBACK_PATH,
} from "@/lib/auth/email-verification/constants";
import { renderEmail, type RenderedEmail } from "./render";

/**
 * BLVS-15: the confirmation link points at our route handler, which checks
 * the token with `verifyOtp` and shows the outcome on the «Conferma email»
 * page (expired or replaced links included), instead of GoTrue's /verify.
 */
export const CONFIRMATION_LINK = `{{ .SiteURL }}${EMAIL_VERIFY_CALLBACK_PATH}?token_hash={{ .TokenHash }}&type=email`;

/**
 * Supabase Auth sends the confirmation and password-reset emails itself
 * (supabase/config.toml, `[auth.email.template.*]`). Its templates are Go
 * templates, so they are rendered from the same React Email components with
 * the Go placeholder in place of the link, and committed under
 * supabase/templates. `auth-templates.test.ts` fails when they drift;
 * `npm run email:auth-templates` rewrites them.
 *
 * Supabase Auth sends HTML only: the text version exists for our own queue.
 */
export const SUPABASE_AUTH_TEMPLATES = [
  {
    /** Key under `[auth.email.template.<key>]` in config.toml. */
    key: "confirmation",
    file: "conferma-email.html",
    link: CONFIRMATION_LINK,
    render: () =>
      renderEmail("conferma-email", {
        confirmationUrl: CONFIRMATION_LINK,
        validityMinutes: CONFIRMATION_LINK_TTL_SECONDS / 60,
      }),
  },
  {
    key: "recovery",
    file: "reimposta-password.html",
    link: "{{ .ConfirmationURL }}",
    render: () =>
      renderEmail("reimposta-password", {
        resetUrl: "{{ .ConfirmationURL }}",
      }),
  },
] as const satisfies ReadonlyArray<{
  key: string;
  file: string;
  /** The Go-template link the email must contain. */
  link: string;
  render: () => Promise<RenderedEmail>;
}>;
