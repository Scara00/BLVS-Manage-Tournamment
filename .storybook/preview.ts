import type { Preview } from "@storybook/nextjs-vite";
import { fontVariables } from "../src/lib/fonts";
import "../src/app/globals.css";

/** Reference viewports for the app: phone (390 px) and desktop (1440 px). */
export const VIEWPORTS = {
  mobile390: {
    name: "Mobile 390",
    styles: { width: "390px", height: "844px" },
    type: "mobile",
  },
  desktop1440: {
    name: "Desktop 1440",
    styles: { width: "1440px", height: "900px" },
    type: "desktop",
  },
} as const;

const preview: Preview = {
  parameters: {
    layout: "centered",
    viewport: { options: VIEWPORTS },
    a11y: {
      // Violations fail the story test instead of only showing in the panel.
      test: "error",
      options: {
        runOnly: {
          type: "tag",
          values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"],
        },
      },
    },
  },
  initialGlobals: {
    viewport: { value: "desktop1440", isRotated: false },
  },
  decorators: [
    (Story) => {
      document.documentElement.lang = "it";
      document.documentElement.classList.add(...fontVariables);
      return Story();
    },
  ],
};

export default preview;
