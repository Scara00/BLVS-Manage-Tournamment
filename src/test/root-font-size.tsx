import { useLayoutEffect, type ReactNode } from "react";

/**
 * Story helper: sets `<html>` font-size (e.g. "200%" for WCAG 1.4.4 text
 * resize) while mounted, restoring it on unmount.
 */
export function RootFontSize({
  size,
  children,
}: {
  size: string;
  children: ReactNode;
}) {
  useLayoutEffect(() => {
    const html = document.documentElement;
    const previous = html.style.fontSize;
    html.style.fontSize = size;
    return () => {
      html.style.fontSize = previous;
    };
  }, [size]);
  return children;
}
