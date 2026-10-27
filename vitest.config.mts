import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    tsconfigPaths: true,
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    include: [
      "src/**/*.test.{ts,tsx}",
      // Pure worker logic shared with the Supabase Edge Functions (Deno).
      "supabase/functions/_shared/**/*.test.ts",
    ],
  },
});
