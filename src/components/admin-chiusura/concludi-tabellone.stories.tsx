import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import type { ConcludiTabelloneAction } from "@/lib/tappe/chiusura/state";
import { ConcludiTabellone } from "./concludi-tabellone";

const concludiFinto: ConcludiTabelloneAction = async (prev) => {
  await new Promise((r) => setTimeout(r, 400));
  return {
    status: "success",
    message: "Tabellone maschile concluso: i punti sono definitivi.",
    tappaConclusa: false,
    at: prev.status === "idle" ? 1 : prev.at + 1,
  };
};

const meta = {
  title: "Admin/Concludi tabellone",
  component: ConcludiTabellone,
  args: {
    tappaId: "jesolo",
    tappaNome: "Tappa 1 · Jesolo",
    categoria: "M",
    action: concludiFinto,
  },
  decorators: [
    (Story) => (
      <div className="max-w-2xl p-inset">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof ConcludiTabellone>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Both finals played: the action, before the confirmation. */
export const Default: Story = {};

/** w-admin-live «Concludi tabellone»: the confirmation dialog. */
export const Dialog: Story = { args: { defaultOpen: true } };

/** The server refused: a tie to decide, with the link to resolve it. */
export const Parita: Story = {
  args: {
    defaultOpen: true,
    initialState: {
      status: "error",
      reason: "bloccato",
      message:
        "Non si può concludere: c'è una parità da risolvere (Finale gold).",
      link: { href: "#girone-live-finale_gold", label: "Risolvi parità" },
      at: 1,
    },
  },
};

/** No network: the confirmation is disabled with the reason. */
export const Offline: Story = { args: { defaultOpen: true, offline: true } };

/** Already concluded: only the outcome, as text. */
export const Concluso: Story = { args: { concluso: true } };

export const Testo200: Story = {
  args: { defaultOpen: true },
  parameters: { text200: true },
};
