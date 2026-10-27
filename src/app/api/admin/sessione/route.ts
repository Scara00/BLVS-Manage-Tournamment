import { NextResponse, type NextRequest } from "next/server";
import {
  ADMIN_DEADLINE_COOKIE,
  deadlineCookieOptions,
  nextDeadline,
  parseDeadline,
  secondsLeft,
  type AdminSessionStatus,
} from "@/lib/admin/session-timeout";
import { withAdmin } from "@/lib/auth/guards";
import { now } from "@/lib/time/server-time";

function status(deadline: number, nowMs: number): AdminSessionStatus {
  return {
    scadeTraSecondi: secondsLeft(deadline, nowMs),
    scadeAlle: new Date(deadline).toISOString(),
  };
}

const noStore = { "cache-control": "private, no-store" };

/**
 * Time left before the admin session closes. Polling it is not activity:
 * the proxy leaves the deadline alone for this GET. An expired deadline
 * never gets here (the proxy answers 401).
 */
export const GET = withAdmin(async (request: NextRequest) => {
  const nowMs = now().getTime();
  // Missing on the very first admin request: the proxy has just set it.
  const deadline =
    parseDeadline(request.cookies.get(ADMIN_DEADLINE_COOKIE)?.value) ??
    nextDeadline(nowMs);
  return NextResponse.json(status(deadline, nowMs), { headers: noStore });
});

/** «Prolunga sessione»: a fresh deadline, without reloading the page. */
export const POST = withAdmin(async () => {
  const nowMs = now().getTime();
  const deadline = nextDeadline(nowMs);
  const response = NextResponse.json(status(deadline, nowMs), {
    headers: noStore,
  });
  response.cookies.set(
    ADMIN_DEADLINE_COOKIE,
    String(deadline),
    deadlineCookieOptions(),
  );
  return response;
});
