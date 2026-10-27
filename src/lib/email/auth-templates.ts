import { renderEmail, type RenderedEmail } from "./render";

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
    render: () =>
      renderEmail("conferma-email", {
        confirmationUrl: "{{ .ConfirmationURL }}",
      }),
  },
  {
    key: "email_change",
    file: "conferma-nuova-email.html",
    render: () =>
      renderEmail("conferma-nuova-email", {
        confirmationUrl: "{{ .ConfirmationURL }}",
        currentEmail: "{{ .Email }}",
        newEmail: "{{ .NewEmail }}",
      }),
  },
  {
    key: "recovery",
    file: "reimposta-password.html",
    render: () =>
      renderEmail("reimposta-password", {
        resetUrl: "{{ .ConfirmationURL }}",
      }),
  },
] as const satisfies ReadonlyArray<{
  key: string;
  file: string;
  render: () => Promise<RenderedEmail>;
}>;
