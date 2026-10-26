import { createServerClient } from "@supabase/ssr";
import { isAuthSessionMissingError } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { readSupabaseEnv } from "./env";

let warnedMissingEnv = false;

/**
 * Refreshes the Supabase auth session on every matched request and forwards
 * the rotated auth cookies to both the downstream render and the browser.
 * Server Components cannot write cookies, so this is where tokens get renewed.
 */
export async function updateSession(request: NextRequest) {
  const env = readSupabaseEnv();

  if (!env) {
    // Let the app run (e.g. CI, e2e) without Supabase, but make it visible.
    if (!warnedMissingEnv) {
      warnedMissingEnv = true;
      console.warn(
        "[supabase] NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY not set: session refresh disabled.",
      );
    }
    return NextResponse.next({ request });
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient(env.url, env.publishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value),
        );
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
        // Cache-control headers that keep CDNs from caching per-user cookies.
        Object.entries(headers).forEach(([key, value]) =>
          response.headers.set(key, value),
        );
      },
    },
  });

  // Do not run code between createServerClient and getClaims(): it validates
  // the JWT and triggers the refresh that calls setAll above.
  const { error } = await supabase.auth.getClaims();

  if (error && !isAuthSessionMissingError(error)) {
    console.error("[supabase] session refresh failed", error);
  }

  return response;
}
