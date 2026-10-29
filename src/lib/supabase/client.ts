import { createBrowserClient } from "@supabase/ssr";
import { getSupabaseEnv } from "./env";

export function createClient() {
  const { url, publishableKey } = getSupabaseEnv();
  return createBrowserClient(url, publishableKey, {
    // The browser rewrites the session cookies when it refreshes the
    // tokens: keep them HTTPS-only wherever the page is on HTTPS.
    cookieOptions: {
      secure:
        typeof window !== "undefined" && window.location.protocol === "https:",
    },
  });
}
