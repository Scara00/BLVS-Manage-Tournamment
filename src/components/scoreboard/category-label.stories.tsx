import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { CategoryLabel } from "./category-label";

const meta = {
  title: "Tabellone/CategoryLabel",
  component: CategoryLabel,
  args: { category: "maschile" },
  argTypes: {
    category: { control: "inline-radio", options: ["maschile", "femminile"] },
  },
} satisfies Meta<typeof CategoryLabel>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Femminile: Story = {
  args: { category: "femminile" },
};
