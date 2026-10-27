import { createServerClient } from "@supabase/ssr";
import { isAuthSessionMissingError } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { FORBIDDEN_MESSAGE } from "@/lib/api/responses";
import {
  LOGIN_PATH,
  loginHref,
  requiresSession,
  safeAfterLoginPath,
  sessionExpiredHref,
} from "@/lib/navigation/auth-paths";
import { RETURN_PARAM } from "@/lib/navigation/safe-return-path";
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

/** Supabase auth cookie, possibly chunked: `sb-<ref>-auth-token[.N]`. */
const AUTH_COOKIE = /^sb-.+-auth-token(?:\.\d+)?$/;

/** Only page loads are redirected; actions and other methods pass through. */
function isNavigation(request: NextRequest): boolean {
  return request.method === "GET" || request.method === "HEAD";
}

/** A redirect that keeps the cookie changes (e.g. a cleared expired session). */
function redirectKeepingCookies(
  request: NextRequest,
  response: NextResponse,
  location: string,
): NextResponse {
  const redirect = NextResponse.redirect(new URL(location, request.url));
  response.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
  const cacheControl = response.headers.get("cache-control");
  if (cacheControl) redirect.headers.set("cache-control", cacheControl);
  return redirect;
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

  // Read before the refresh, which may clear an expired session's cookies.
  const hadSession = request.cookies
    .getAll()
    .some((cookie) => AUTH_COOKIE.test(cookie.name));

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

  // Optimistic page guard: the authoritative checks stay on the server
  // (getCurrentUser / withAdmin). A cookie whose session no longer verifies
  // means the session expired: say so, and remember where the user was.
  const { pathname, search } = request.nextUrl;
  const signedIn = Boolean(data?.claims?.sub);
  if (isNavigation(request) && !signedIn && requiresSession(pathname)) {
    const from = `${pathname}${search}`;
    return redirectKeepingCookies(
      request,
      response,
      hadSession ? sessionExpiredHref(from) : loginHref(from),
    );
  }
  if (isNavigation(request) && signedIn && pathname === LOGIN_PATH) {
    const back = safeAfterLoginPath(
      request.nextUrl.searchParams.get(RETURN_PARAM),
    );
    return redirectKeepingCookies(request, response, back);
  }

  return response;
}
