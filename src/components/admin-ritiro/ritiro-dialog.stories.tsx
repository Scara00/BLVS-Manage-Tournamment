import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { fn, userEvent, within } from "storybook/test";
import { RitiroDialog } from "./ritiro-dialog";
import {
  azioneInAttesa,
  azioneOk,
  girone,
  impattoFase,
  partiteGirone,
} from "./stories-data";

const meta = {
  title: "Admin/Ritiro o assenza",
  component: RitiroDialog,
  args: {
    tappaId: "jesolo",
    categoria: "M",
    girone,
    partite: partiteGirone,
    assenze: [],
    action: azioneOk,
    online: true,
    onEsito: fn(),
    defaultOpen: true,
  },
} satisfies Meta<typeof RitiroDialog>;

export default meta;
type Story = StoryObj<typeof meta>;

/** w-admin-ritiro, nothing chosen yet. */
export const Vuoto: Story = {};

/** A withdrawal of Rossi: the matches to play are ticked, with the preview. */
export const Anteprima: Story = {
  args: { defaultGiocatore: "i-Rossi", defaultTipo: "ritiro" },
};

/** Submitted empty: each error sits next to its field. */
export const ErroriCampi: Story = {
  args: {
    initialState: {
      status: "fieldErrors",
      errori: {
        giocatore: "Scegli il giocatore.",
        tipo: "Scegli se è un ritiro o un'assenza.",
        partite: "Scegli almeno una partita.",
      },
      at: 1,
    },
  },
};

/** Waiting for the server after «Registra il ritiro». */
export const InCaricamento: Story = {
  args: {
    defaultGiocatore: "i-Rossi",
    defaultTipo: "ritiro",
    action: azioneInAttesa,
  },
  play: async () => {
    const body = within(document.body);
    await userEvent.click(
      await body.findByRole("button", { name: /Registra il ritiro/ }),
    );
  },
};

/** The next phase already exists: w-admin-impatto-fase on top. */
export const ImpattoSullaFase: Story = {
  args: {
    defaultGiocatore: "i-Rossi",
    defaultTipo: "assenza",
    initialState: {
      status: "impatto",
      impatto: impattoFase,
      erroreConferma: null,
      avviso: null,
      at: 1,
    },
  },
};

/** Offline: the dialog explains why it cannot save. */
export const Offline: Story = {
  args: { defaultGiocatore: "i-Rossi", defaultTipo: "ritiro", online: false },
};
