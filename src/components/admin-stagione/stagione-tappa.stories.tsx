import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Toaster, ToastProvider } from "@/components/ui/toast";
import {
  STAGIONE_MESSAGES,
  type StagioneAction,
} from "@/lib/tappe/stagione/types";
import { StagioneTappa } from "./stagione-tappa";

const salvaFinto: StagioneAction = async (_prev, formData) => ({
  status: "success",
  stagione: Number(formData.get("stagione")),
  message: STAGIONE_MESSAGES.salvata(Number(formData.get("stagione"))),
  at: 1,
});

function Schermata(props: Parameters<typeof StagioneTappa>[0]) {
  return (
    <ToastProvider>
      <StagioneTappa {...props} />
      <Toaster />
    </ToastProvider>
  );
}

const meta = {
  title: "Admin/Tappa/Stagione della classifica",
  component: Schermata,
  args: {
    tappaId: "rimini",
    stagione: 2026,
    modificabile: true,
    action: salvaFinto,
  },
  parameters: { layout: "padded" },
} satisfies Meta<typeof Schermata>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Modificabile: Story = {};

export const AnnoNonValido: Story = {
  args: {
    initialState: {
      status: "error",
      reason: "invalid",
      message: STAGIONE_MESSAGES.invalida,
      campo: STAGIONE_MESSAGES.invalida,
      at: 1,
    },
  },
};

export const ErroreDiRete: Story = {
  args: {
    initialState: {
      status: "error",
      reason: "network",
      message:
        "Non è stato possibile salvare: controlla la connessione e riprova.",
      at: 1,
    },
  },
};

/** Archived: the season is shown as text only. */
export const Archiviata: Story = { args: { modificabile: false } };
