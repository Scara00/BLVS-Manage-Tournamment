import { createServerClient } from "@supabase/ssr";
import { isAuthSessionMissingError } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { FORBIDDEN_MESSAGE } from "@/lib/api/responses";
import { readSupabaseEnv } from "./env";

let warnedMissingEnv = false;

function isAdminApi(request: NextRequest): boolean {
  const { pathname } = request.nextUrl;
  return pathname === "/api/admin" || pathname.startsWith("/api/admin/");
}

/**
 * Optimistic gate: an admin API call without a valid session is refused
 * here, before rendering. The authoritative role check is `withAdmin`.
 */
function forbiddenAdminApi(): NextResponse {
  return NextResponse.json({ error: FORBIDDEN_MESSAGE }, { status: 403 });
}

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
    return isAdminApi(request)
      ? forbiddenAdminApi()
      : NextResponse.next({ request });
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
  const { data, error } = await supabase.auth.getClaims();

  if (error && !isAuthSessionMissingError(error)) {
    console.error("[supabase] session refresh failed", error);
  }

  if (isAdminApi(request) && !data?.claims?.sub) {
    const denied = forbiddenAdminApi();
    // Keep the cookie clean-up (e.g. an expired session) on the 403 too.
    response.cookies.getAll().forEach((cookie) => denied.cookies.set(cookie));
    return denied;
  }

  return response;
}
