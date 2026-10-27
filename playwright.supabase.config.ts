import { defineConfig } from "@playwright/test";

/**
 * Specs that need the local Supabase stack (`supabase start`: Postgres, Auth,
 * Edge Functions, Mailpit). CI runs them in the "Supabase locale" job;
 * locally: `supabase start`, then `eval "$(supabase status -o env)"` and
 * `npm run test:supabase`.
 *
 * The app flows (e.g. password reset) also need Next.js pointed at that
 * stack: it is built and started on PLAYWRIGHT_SUPABASE_APP_PORT, only when
 * the stack's env is present (the specs skip themselves otherwise).
 *
 * BLVS-15: that includes the flows that follow an email link
 * (e2e/supabase/email-verify.spec.ts); the specs rebase the link onto
 * baseURL, so the app need not run on `site_url`'s port.
 */
const PORT = Number(process.env.PLAYWRIGHT_SUPABASE_APP_PORT ?? 3200);
const baseURL = `http://localhost:${PORT}`;
const supabaseUrl = process.env.API_URL;
const publishableKey = process.env.PUBLISHABLE_KEY || process.env.ANON_KEY;

export default defineConfig({
  testDir: "./e2e/supabase",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: { baseURL, trace: "on-first-retry" },
  projects: [{ name: "supabase" }],
  webServer:
    supabaseUrl && publishableKey
      ? {
          command: `npm run build && npm run start -- --port ${PORT}`,
          url: baseURL,
          reuseExistingServer: !process.env.CI,
          timeout: 300_000,
          env: {
            TZ: "Europe/Rome",
            ENFORCE_HTTPS: "false",
            NEXT_PUBLIC_SUPABASE_URL: supabaseUrl,
            NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: publishableKey,
            SUPABASE_SECRET_KEY:
              process.env.SECRET_KEY ?? process.env.SERVICE_ROLE_KEY ?? "",
          },
        }
      : undefined,
});
