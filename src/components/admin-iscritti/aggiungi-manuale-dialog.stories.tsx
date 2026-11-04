import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { withText200 } from "@/design-system/text-200";
import type { ModificaIscrittiAction } from "@/lib/iscrizioni/admin/types";
import { AggiungiManualeDialog } from "./aggiungi-manuale-dialog";

const aggiungiFinta: ModificaIscrittiAction = async () => ({
  status: "success",
  message: "Verdi Mario ora ha il posto 7.",
  at: 1,
});

/** w-admin-aggiungi-manuale. Open by default so axe sees the dialog. */
const meta = {
  title: "Admin/Aggiungi a mano",
  component: AggiungiManualeDialog,
  args: { tappaId: "rimini", action: aggiungiFinta, defaultOpen: true },
  parameters: {
    nextjs: {
      appDirectory: true,
      navigation: { pathname: "/admin/tappe/rimini/iscritti" },
    },
  },
} satisfies Meta<typeof AggiungiManualeDialog>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Vuoto: Story = {};

/** Stays open for the next player. */
export const Aggiunto: Story = {
  args: {
    initialState: {
      status: "success",
      message: "Verdi Mario ora ha il posto 7.",
      at: 1,
    },
  },
};

/** The server refused: nothing was created. */
export const PostiEsauriti: Story = {
  args: {
    initialState: {
      status: "error",
      reason: "invalid",
      message:
        "Posti esauriti in questo tabellone: libera un posto prima di aggiungere.",
      at: 1,
    },
  },
};

export const SessioneScaduta: Story = {
  args: {
    initialState: {
      status: "error",
      reason: "sessionExpired",
      message: "La sessione è scaduta: accedi di nuovo per continuare.",
      at: 1,
    },
  },
};

export const Testo200: Story = { decorators: [withText200] };
