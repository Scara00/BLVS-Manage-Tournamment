"use client";

import { usePathname } from "next/navigation";
import { useId, useRef, useState, type KeyboardEvent } from "react";
import { DESKTOP_QUERY, useMediaQuery } from "@/hooks/use-media-query";

/**
 * State for a mobile nav disclosure (`<button aria-expanded>` + panel).
 * It closes on Escape (focus goes back to the button), on route change and
 * when the viewport crosses to the desktop layout, where the panel is moot.
 */
export function useNavDisclosure() {
  const pathname = usePathname();
  const isDesktop = useMediaQuery(DESKTOP_QUERY);
  const panelId = useId();
  const buttonRef = useRef<HTMLButtonElement>(null);
  // The path the panel was opened on: navigating elsewhere closes it.
  const [openedAt, setOpenedAt] = useState<string | null>(null);

  if (isDesktop && openedAt !== null) setOpenedAt(null);
  const open = !isDesktop && openedAt === pathname;

  function onKeyDown(event: KeyboardEvent) {
    if (event.key !== "Escape" || !open) return;
    event.preventDefault();
    setOpenedAt(null);
    buttonRef.current?.focus();
  }

  return {
    pathname,
    open,
    close: () => setOpenedAt(null),
    buttonProps: {
      ref: buttonRef,
      type: "button" as const,
      "aria-expanded": open,
      "aria-controls": panelId,
      onClick: () => setOpenedAt(open ? null : pathname),
      onKeyDown,
    },
    panelProps: { id: panelId, hidden: !open, onKeyDown },
  };
}
