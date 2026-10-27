import { defineConfig, devices } from "@playwright/test";

const PORT = Number(process.env.PLAYWRIGHT_PORT ?? 3100);
const STORYBOOK_PORT = Number(process.env.PLAYWRIGHT_STORYBOOK_PORT ?? 6106);
const baseURL = `http://localhost:${PORT}`;
const storybookURL = `http://localhost:${STORYBOOK_PORT}`;

/** The two reference viewports: phone (390 px) and desktop (1440 px). */
const mobile390 = {
  ...devices["Desktop Chrome"],
  viewport: { width: 390, height: 844 },
  isMobile: true,
  hasTouch: true,
};
const desktop1440 = {
  ...devices["Desktop Chrome"],
  viewport: { width: 1440, height: 900 },
};

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL,
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "mobile-390",
      testIgnore: /storybook/,
      use: mobile390,
    },
    {
      name: "desktop-1440",
      testIgnore: /storybook/,
      use: desktop1440,
    },
    {
      // Runs axe on every story of the static Storybook, at both viewports.
      name: "storybook",
      testMatch: /storybook.*\.spec\.ts/,
      use: { ...desktop1440, baseURL: storybookURL },
    },
  ],
  webServer: [
    {
      command: `npm run build && npm run start -- --port ${PORT}`,
      url: baseURL,
      reuseExistingServer: !process.env.CI,
      timeout: 180_000,
      // HTTPS is enforced only on staging/production; e2e runs on http://localhost.
      // LIVE_DEMO_PUBLISH opens POST /api/live/publish so e2e can "save" a result.
      env: {
        TZ: "Europe/Rome",
        ENFORCE_HTTPS: "false",
        LIVE_DEMO_PUBLISH: "true",
      },
    },
    {
      // CI downloads the storybook-static artifact and sets STORYBOOK_PREBUILT.
      command: `${process.env.STORYBOOK_PREBUILT ? "" : "npm run build-storybook && "}npx http-server storybook-static -p ${STORYBOOK_PORT} -s -c-1`,
      url: `${storybookURL}/index.json`,
      reuseExistingServer: !process.env.CI,
      timeout: 180_000,
    },
  ],
});
