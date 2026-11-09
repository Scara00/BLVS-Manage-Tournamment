import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { AvvisoTappaProva } from "./avviso-tappa-prova";

/** The notice above the player pages of a «tappa di prova» (admins only). */
const meta = {
  title: "Tappa/Avviso tappa di prova",
  component: AvvisoTappaProva,
} satisfies Meta<typeof AvvisoTappaProva>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Testo200: Story = { parameters: { text200: true } };
