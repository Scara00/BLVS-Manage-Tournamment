"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/** A section is current once its top passes this fraction of the viewport. */
const ACTIVATION_LINE = 0.3;

function isInViewport(el: HTMLElement) {
  const rect = el.getBoundingClientRect();
  return rect.bottom > 0 && rect.top < window.innerHeight;
}

/**
 * Scroll spy for an in-page index: the current section is the last one whose
 * top has crossed the activation line. A section picked from the index stays
 * current while it is on screen, even when it is too short (or too close to
 * the end of the page) to reach the line.
 */
export function useActiveSection(ids: readonly string[]) {
  const [active, setActive] = useState<string>(ids[0] ?? "");
  const pinned = useRef<string | null>(null);

  useEffect(() => {
    const sections = ids
      .map((id) => document.getElementById(id))
      .filter((el): el is HTMLElement => el !== null);
    if (sections.length === 0) return;

    let frame = 0;
    const update = () => {
      frame = 0;
      const pin = pinned.current && document.getElementById(pinned.current);
      if (pin && isInViewport(pin)) {
        setActive(pin.id);
        return;
      }
      pinned.current = null;
      const line = window.innerHeight * ACTIVATION_LINE;
      let current = sections[0].id;
      for (const section of sections) {
        if (section.getBoundingClientRect().top <= line) current = section.id;
      }
      setActive(current);
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    const fromHash = () => {
      const id = decodeURIComponent(window.location.hash.slice(1));
      if (ids.includes(id)) pinned.current = id;
      update();
    };

    fromHash();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    window.addEventListener("hashchange", fromHash);
    return () => {
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      window.removeEventListener("hashchange", fromHash);
    };
  }, [ids]);

  /** Marks `id` current right away (index link activated). */
  const select = useCallback((id: string) => {
    pinned.current = id;
    setActive(id);
  }, []);

  return { active, select };
}
