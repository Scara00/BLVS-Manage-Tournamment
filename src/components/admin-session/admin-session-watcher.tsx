"use client";

import { useState } from "react";
import type { SignOutAction } from "@/components/layout/sign-out-button";
import { useToast } from "@/components/ui/toast";
import { formatServerTime } from "@/lib/time/server-time";
import { AdminSessionWarning } from "./admin-session-warning";
import { ADMIN_SESSION_MESSAGES as M } from "./messages";
import {
  useAdminSession,
  type UseAdminSessionOptions,
} from "./use-admin-session";

/**
 * Mounted once by the admin layout: watches the admin idle deadline and
 * shows the warning before it. Extending is a fetch, never a navigation or
 * a refresh, so whatever is typed in the page's forms stays where it is.
 */
export function AdminSessionWatcher({
  signOut,
  ...options
}: UseAdminSessionOptions & { signOut: SignOutAction }) {
  const { open, secondsLeft, expired, extend } = useAdminSession(options);
  const toast = useToast();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onExtend() {
    if (pending) return;
    setPending(true);
    setError(null);
    const result = await extend();
    setPending(false);
    if (result.ok)
      toast.add({
        title: M.extendedTitle,
        description: M.extendedUntil(
          formatServerTime(result.until, { timeStyle: "short" }),
        ),
      });
    else if (!result.expired) setError(M.extendError);
  }

  return (
    <AdminSessionWarning
      open={open}
      secondsLeft={secondsLeft}
      expired={expired}
      pending={pending}
      error={open ? error : null}
      onExtend={() => void onExtend()}
      signOut={signOut}
    />
  );
}
