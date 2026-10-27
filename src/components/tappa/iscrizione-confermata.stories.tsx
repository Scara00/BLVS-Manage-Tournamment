import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { withText200 } from "@/design-system/text-200";
import { CONFERMATA } from "./fixtures";
import { IscrizioneConfermataView } from "./iscrizione-confermata";

const meta = {
  title: "Tappa/Iscrizione confermata",
  component: IscrizioneConfermataView,
  args: { iscrizione: CONFERMATA },
} satisfies Meta<typeof IscrizioneConfermataView>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Confermata: Story = {};
export const SenzaRitrovo: Story = {
  args: {
    iscrizione: {
      ...CONFERMATA,
      ritrovo: null,
      ritrovoAlle: null,
      annullaEntro: null,
      annullaEntroIso: null,
    },
  },
};
export const Testo200: Story = { decorators: [withText200] };
