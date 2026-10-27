import { useLayoutEffect, type ReactNode } from "react";
import type { Decorator } from "@storybook/nextjs-vite";

function Text200({ children }: { children: ReactNode }) {
  useLayoutEffect(() => {
    const html = document.documentElement;
    const previous = html.style.fontSize;
    html.style.fontSize = "200%";
    return () => {
      html.style.fontSize = previous;
    };
  }, []);
  return children;
}

/**
 * Renders the story with the root font size at 200 % (WCAG 1.4.4) and
 * restores it on unmount, so it does not leak into other stories.
 */
export const withText200: Decorator = (Story) => (
  <Text200>
    <Story />
  </Text200>
);
