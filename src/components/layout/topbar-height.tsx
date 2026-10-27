"use client";

import { useEffect, useRef } from "react";

/**
 * Publishes the real height of the sticky topbar as `--app-topbar-h`, so
 * `scroll-padding-top` keeps focused elements clear of it even when its
 * content wraps (long text, 200% text size). When the topbar is not sticky
 * (mobile) the value is 0. Without JS, the rem fallback in globals.css holds.
 */
export function TopbarHeight() {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const header = ref.current?.closest("header");
    if (!header) return;
    const root = document.documentElement;

    const update = () => {
      const sticky = getComputedStyle(header).position === "sticky";
      root.style.setProperty(
        "--app-topbar-h",
        sticky ? `${header.getBoundingClientRect().height}px` : "0px",
      );
    };

    update();
    const observer =
      typeof ResizeObserver === "undefined" ? null : new ResizeObserver(update);
    observer?.observe(header);
    window.addEventListener("resize", update);
    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", update);
      root.style.removeProperty("--app-topbar-h");
    };
  }, []);

  return <span ref={ref} hidden />;
}
