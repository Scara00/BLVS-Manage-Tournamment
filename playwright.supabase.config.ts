import { defineConfig } from "@playwright/test";

/**
 * Specs that need the local Supabase stack (`supabase start`: Postgres, Auth,
 * Edge Functions, Mailpit). CI runs them in the "Supabase locale" job;
 * locally: `supabase start`, then `eval "$(supabase status -o env)"` and
 * `npm run test:supabase`.
 *
 * BLVS-15: the app runs too, pointed at the local stack, so the flows that
 * follow an email link (e2e/supabase/email-verify.spec.ts) work end to end.
 * Port 3000 matches `site_url` in supabase/config.toml, the host of the links.
 */
const PORT = Number(process.env.PLAYWRIGHT_SUPABASE_PORT ?? 3000);
const baseURL = `http://127.0.0.1:${PORT}`;

export default defineConfig({
  testDir: "./e2e/supabase",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: { baseURL, trace: "on-first-retry" },
  projects: [{ name: "supabase" }],
  webServer: {
    command: `npm run build && npm run start -- --port ${PORT} --hostname 127.0.0.1`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 240_000,
    env: {
      TZ: "Europe/Rome",
      ENFORCE_HTTPS: "false",
      NEXT_PUBLIC_SUPABASE_URL: process.env.API_URL ?? "http://127.0.0.1:54321",
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:
        process.env.PUBLISHABLE_KEY ?? process.env.ANON_KEY ?? "",
      SUPABASE_SECRET_KEY:
        process.env.SECRET_KEY ?? process.env.SERVICE_ROLE_KEY ?? "",
    },
  },
});
