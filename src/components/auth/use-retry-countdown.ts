"use client";

import { useEffect, useState } from "react";
import { now } from "@/lib/time/server-time";

/**
 * True while `retryAt` (ISO) is in the future; flips to false by itself when
 * the wait is over, so a suspended login re-enables its button.
 */
export function useRetryCountdown(retryAt: string | undefined): boolean {
  const [expiredFor, setExpiredFor] = useState<string | undefined>();

  useEffect(() => {
    if (!retryAt) return;
    const delay = new Date(retryAt).getTime() - now().getTime();
    const timer = setTimeout(() => setExpiredFor(retryAt), Math.max(0, delay));
    return () => clearTimeout(timer);
  }, [retryAt]);

  return Boolean(retryAt) && expiredFor !== retryAt;
}
