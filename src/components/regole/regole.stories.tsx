import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Regole } from "./regole";

type Stato = "success" | "sessionExpired" | "text200";

/** w-regole body in every state: the text comes from the configuration. */
function RegoleScreen({ stato }: { stato: Stato }) {
  return <Regole sessioneScaduta={stato === "sessionExpired"} />;
}

const meta = {
  title: "Regole/Regole e punteggi",
  component: RegoleScreen,
  args: { stato: "success" },
  argTypes: {
    stato: {
      control: "inline-radio",
      options: ["success", "sessionExpired", "text200"],
    },
  },
  parameters: { layout: "padded" },
} satisfies Meta<typeof RegoleScreen>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Success: Story = {};

/** Public page: the banner sits above the rules, which stay readable. */
export const SessionExpired: Story = { args: { stato: "sessionExpired" } };

/** 200 % text: steps, criteria and the points table wrap, no sideways scroll. */
export const Text200: Story = {
  args: { stato: "text200" },
  parameters: { text200: true },
};
