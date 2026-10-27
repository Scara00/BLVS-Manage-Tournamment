"use client";

import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ADMIN_SESSION_API_PATH,
  type AdminSessionStatus,
} from "@/lib/admin/session-timeout";
import { flushDrafts } from "@/lib/drafts/drafts";
import { sessionExpiredHref } from "@/lib/navigation/auth-paths";
import { now } from "@/lib/time/server-time";
import {
  AdminSessionTimer,
  type AdminSessionSnapshot,
} from "./admin-session-timer";

/** Tabs of the same browser keep each other in step through this channel. */
const CHANNEL_NAME = "blvs:sessione-admin";
type ChannelMessage = "prolungata" | "scaduta";

export type ExtendResult =
  { ok: true; until: Date } | { ok: false; expired: boolean };

export type UseAdminSessionOptions = {
  /**
   * `true` when the server enforces the deadline (Supabase configured): the
   * browser asks it for the time left. `false` in the demo (CI/e2e): the
   * countdown runs in the browser only.
   */
  enforced: boolean;
  idleSeconds: number;
  warningSeconds: number;
  /** Leaves the page once the session is closed; tests replace it. */
  redirect?: (href: string) => void;
};

type Controller = {
  sync: () => Promise<void>;
  activity: () => void;
  extend: () => Promise<ExtendResult>;
};

function leave(href: string) {
  window.location.assign(href);
}

async function readStatus(response: Response) {
  const body = (await response.json()) as AdminSessionStatus;
  return typeof body.scadeTraSecondi === "number" ? body : null;
}

/**
 * The admin idle-timeout state machine: counts down, opens the warning in
 * the last `warningSeconds`, extends without reloading the page, and at the
 * deadline saves the drafts and goes to the expired-session page.
 */
export function useAdminSession({
  enforced,
  idleSeconds,
  warningSeconds,
  redirect = leave,
}: UseAdminSessionOptions) {
  const [snapshot, setSnapshot] = useState<AdminSessionSnapshot>({
    phase: "active",
    secondsLeft: idleSeconds,
  });
  const [expired, setExpired] = useState(false);
  const controller = useRef<Controller | null>(null);
  const redirectRef = useRef(redirect);
  useEffect(() => {
    redirectRef.current = redirect;
  }, [redirect]);

  useEffect(() => {
    let closed = false;
    // Enforced only: the server confirmed an admin session at least once.
    let confirmed = false;
    const channel =
      typeof BroadcastChannel === "undefined"
        ? null
        : new BroadcastChannel(CHANNEL_NAME);
    const post = (message: ChannelMessage) => {
      try {
        channel?.postMessage(message);
      } catch {
        // A closed channel: the other tabs resync on their own.
      }
    };

    const close = () => {
      if (closed) return;
      closed = true;
      timer.stop();
      setExpired(true);
      post("scaduta");
      // Drafts first, then leave: the form values are still in the DOM.
      flushDrafts();
      const from = `${window.location.pathname}${window.location.search}`;
      redirectRef.current(sessionExpiredHref(from));
    };

    /** Asks the server; `atDeadline` treats a network failure as expiry. */
    const sync = async (atDeadline = false) => {
      if (closed) return;
      if (!enforced) {
        if (atDeadline) close();
        return;
      }
      let response: Response | null = null;
      try {
        response = await fetch(ADMIN_SESSION_API_PATH, { cache: "no-store" });
      } catch {
        response = null;
      }
      if (closed) return;
      if (!response) {
        if (atDeadline) close();
        return;
      }
      // 401: the proxy closed it. 403 after a confirmed session: closed
      // elsewhere (another tab). 403 at first: not an admin session at all.
      if (response.status === 401 || (response.status === 403 && confirmed))
        return close();
      const status = response.ok ? await readStatus(response) : null;
      if (closed) return;
      if (!status) {
        timer.stop();
        return;
      }
      confirmed = true;
      if (status.scadeTraSecondi <= 0) close();
      else timer.start(status.scadeTraSecondi);
    };

    const timer = new AdminSessionTimer({
      warningSeconds,
      onChange: setSnapshot,
      onDeadline: () => void sync(true),
    });

    controller.current = {
      sync: () => sync(),
      // A navigation: the server moved the deadline; the demo does it here.
      activity: () => {
        if (closed) return;
        if (enforced) void sync();
        else timer.start(idleSeconds);
      },
      extend: async () => {
        if (closed) return { ok: false, expired: true };
        if (!enforced) {
          timer.start(idleSeconds);
          post("prolungata");
          return {
            ok: true,
            until: new Date(now().getTime() + idleSeconds * 1000),
          };
        }
        try {
          const response = await fetch(ADMIN_SESSION_API_PATH, {
            method: "POST",
            cache: "no-store",
          });
          if (response.status === 401 || response.status === 403) {
            close();
            return { ok: false, expired: true };
          }
          const status = response.ok ? await readStatus(response) : null;
          if (!status) return { ok: false, expired: false };
          confirmed = true;
          timer.start(status.scadeTraSecondi);
          post("prolungata");
          return { ok: true, until: new Date(status.scadeAlle) };
        } catch {
          return { ok: false, expired: false };
        }
      },
    };

    if (channel)
      channel.onmessage = (event: MessageEvent<ChannelMessage>) => {
        if (enforced) void sync();
        else if (event.data === "prolungata") timer.start(idleSeconds);
        else close();
      };

    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
      if (enforced) void sync();
      else timer.refresh();
    };
    document.addEventListener("visibilitychange", onVisible);

    if (enforced) void sync();
    else timer.start(idleSeconds);

    return () => {
      closed = true;
      timer.stop();
      channel?.close();
      document.removeEventListener("visibilitychange", onVisible);
      controller.current = null;
    };
  }, [enforced, idleSeconds, warningSeconds]);

  // Moving to another admin page is activity.
  const pathname = usePathname();
  const lastPathname = useRef(pathname);
  useEffect(() => {
    if (lastPathname.current === pathname) return;
    lastPathname.current = pathname;
    controller.current?.activity();
  }, [pathname]);

  const extend = useCallback(
    (): Promise<ExtendResult> =>
      controller.current?.extend() ??
      Promise.resolve({ ok: false, expired: true }),
    [],
  );

  return {
    open: expired || snapshot.phase === "warning",
    secondsLeft: snapshot.secondsLeft,
    expired,
    extend,
  };
}
