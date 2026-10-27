import {
  RESET_LINK_VALIDITY_MINUTES,
  RESET_PASSWORD_PATH,
} from "@/lib/auth/password-reset/messages";
import { renderEmail, type RenderedEmail } from "./render";

/** Password reset link: our page, with the hash of the one-time token. */
export const RECOVERY_LINK = `{{ .SiteURL }}${RESET_PASSWORD_PATH}?token_hash={{ .TokenHash }}`;

/**
 * Supabase Auth sends the confirmation and password-reset emails itself
 * (supabase/config.toml, `[auth.email.template.*]`). Its templates are Go
 * templates, so they are rendered from the same React Email components with
 * the Go placeholder in place of the link, and committed under
 * supabase/templates. `auth-templates.test.ts` fails when they drift;
 * `npm run email:auth-templates` rewrites them.
 *
 * Supabase Auth sends HTML only: the text version exists for our own queue.
 *
 * The recovery link opens our own page with the token hash instead of
 * Supabase's `/auth/v1/verify`: the token is spent only when the user saves
 * the new password (`POST /api/auth/password/reimposta`), so link scanners
 * and prefetchers cannot use it up (BLVS-14).
 */
export const SUPABASE_AUTH_TEMPLATES = [
  {
    /** Key under `[auth.email.template.<key>]` in config.toml. */
    key: "confirmation",
    file: "conferma-email.html",
    href: "{{ .ConfirmationURL }}",
    render: () =>
      renderEmail("conferma-email", {
        confirmationUrl: "{{ .ConfirmationURL }}",
      }),
  },
  {
    key: "recovery",
    file: "reimposta-password.html",
    href: RECOVERY_LINK,
    render: () =>
      renderEmail("reimposta-password", {
        resetUrl: RECOVERY_LINK,
        validityMinutes: RESET_LINK_VALIDITY_MINUTES,
      }),
  },
] as const satisfies ReadonlyArray<{
  key: string;
  file: string;
  /** The link of the email's button, as a Go template expression. */
  href: string;
  render: () => Promise<RenderedEmail>;
}>;
