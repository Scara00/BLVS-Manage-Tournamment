import { defineConfig } from "@playwright/test";

/**
 * Specs that need the local Supabase stack (`supabase start`: Postgres, Auth,
 * Edge Functions, Mailpit) and no Next.js server. CI runs them in the
 * "Supabase locale" job; locally: `supabase start`, then
 * `eval "$(supabase status -o env)"` and `npm run test:supabase`.
 */
export default defineConfig({
  testDir: "./e2e/supabase",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  projects: [{ name: "supabase" }],
});
