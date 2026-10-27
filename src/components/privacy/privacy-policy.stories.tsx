import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { MinimalShell } from "@/components/layout/minimal-shell";
import { PrivacyPolicy } from "./privacy-policy";

const meta = {
  title: "Pagine/Informativa privacy",
  component: PrivacyPolicy,
  parameters: {
    layout: "fullscreen",
    nextjs: {
      appDirectory: true,
      navigation: { pathname: "/privacy", query: { da: "/classifica" } },
    },
  },
  decorators: [
    (Story) => (
      <div className="flex min-h-screen flex-col">
        <MinimalShell>
          <Story />
        </MinimalShell>
      </div>
    ),
  ],
} satisfies Meta<typeof PrivacyPolicy>;

export default meta;
type Story = StoryObj<typeof meta>;

const mobile = { viewport: { value: "mobile390", isRotated: false } };

/** The whole w-privacy screen, with the sample row playing once. */
export const PaginaCompleta: Story = {};

/** Reduced motion: the sample row shows the final values, no flip. */
export const MovimentoRidotto: Story = { args: { reducedMotion: true } };

/** 200 % text at 390 px (WCAG 1.4.4 / 1.4.10): no horizontal scroll. */
export const Testo200: Story = {
  parameters: { text200: true },
  globals: mobile,
};
