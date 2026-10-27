"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * Countdown that blocks «Invia di nuovo». It runs on `performance.now()`
 * (monotonic, not affected by clock changes), so throttled timers in a
 * background tab only delay the display, not the end.
 */
export function useResendCooldown(seconds: number) {
  const [deadline, setDeadline] = useState<number | null>(null);
  const [remaining, setRemaining] = useState(0);

  const start = useCallback(() => {
    setDeadline(performance.now() + seconds * 1000);
    setRemaining(seconds);
  }, [seconds]);

  useEffect(() => {
    if (deadline === null) return;
    const tick = () => {
      const left = Math.max(
        0,
        Math.ceil((deadline - performance.now()) / 1000),
      );
      setRemaining(left);
      if (left === 0) setDeadline(null);
    };
    const id = setInterval(tick, 250);
    return () => clearInterval(id);
  }, [deadline]);

  return { remaining, active: remaining > 0, start };
}

/** 75 → "1:15", 9 → "0:09". */
export function formatCountdown(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const secs = String(totalSeconds % 60).padStart(2, "0");
  return `${minutes}:${secs}`;
}
