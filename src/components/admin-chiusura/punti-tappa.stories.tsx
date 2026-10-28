import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { finaliConcluse } from "@/components/admin-live/stories-data";
import { finaliDaPartite } from "@/lib/tappe/chiusura/regole";
import { classificaTappa } from "@/lib/tappe/classifica/classifica";
import { PuntiTappa } from "./punti-tappa";

const finali = finaliDaPartite(finaliConcluse.partite);

const meta = {
  title: "Admin/Punti della tappa",
  component: PuntiTappa,
  args: { classifica: classificaTappa({ finali, concluso: false }) },
  decorators: [
    (Story) => (
      <div className="max-w-3xl p-inset">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof PuntiTappa>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Finals played, board open: points on tape as «Provvisori». */
export const Provvisori: Story = {};

/** Board concluded: «Definitivi». */
export const Definitivi: Story = {
  args: { classifica: classificaTappa({ finali, concluso: true }) },
};

/** No finals yet. */
export const Empty: Story = {
  args: { classifica: classificaTappa({ finali: [], concluso: false }) },
};

export const Testo200: Story = { parameters: { text200: true } };
