import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { withText200 } from "@/design-system/text-200";
import type { CercaPaletteAction } from "@/lib/admin/palette/types";
import { PaletteComandi } from "./palette-comandi";
import { esitoJesolo, esitoVuoto } from "./stories-data";

const cercaFinta: CercaPaletteAction = async () => esitoJesolo;

/** Never answers: the palette stays «Ricerca in corso…». */
const cercaInCorso: CercaPaletteAction = () => new Promise(() => {});

/**
 * w-admin-palette (BLVS-55). Open by default so axe sees the combobox;
 * the trigger sits on a black bar, as in the admin Topbar.
 */
const meta = {
  title: "Admin/w-admin-palette",
  component: PaletteComandi,
  args: { cerca: cercaFinta, defaultOpen: true },
  decorators: [
    (Story) => (
      <div className="flex justify-end bg-primary p-inset text-primary-foreground">
        <Story />
      </div>
    ),
  ],
  parameters: {
    nextjs: { appDirectory: true, navigation: { pathname: "/admin" } },
  },
} satisfies Meta<typeof PaletteComandi>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Just opened: no text yet, the admin commands are proposed. */
export const Comandi: Story = {};

/** «jesolo»: a stage, a player and a match, grouped. */
export const Risultati: Story = {
  args: {
    initialQuery: "jesolo",
    initialRicerca: { stato: "esito", esito: esitoJesolo },
  },
};

/** Loading: the search is running (announced in the status region). */
export const Loading: Story = {
  args: {
    cerca: cercaInCorso,
    initialQuery: "rossi",
    initialRicerca: { stato: "inCorso" },
  },
};

/** Empty: nothing matches, commands included. */
export const Empty: Story = {
  args: {
    cerca: async () => esitoVuoto,
    initialQuery: "zzzz",
    initialRicerca: { stato: "esito", esito: esitoVuoto },
  },
};

export const Errore: Story = {
  args: {
    initialQuery: "jesolo",
    initialRicerca: {
      stato: "esito",
      esito: {
        status: "error",
        reason: "network",
        message: "Ricerca non riuscita. Riprova tra qualche secondo.",
      },
    },
  },
};

/** Closed: only the «Cerca» button of the Topbar (the way in on touch). */
export const Chiusa: Story = { args: { defaultOpen: false } };

export const Testo200: Story = {
  ...Risultati,
  decorators: [withText200],
};
