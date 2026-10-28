import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { userEvent, within } from "storybook/test";
import { Toaster, ToastProvider } from "@/components/ui/toast";
import { withText200 } from "@/design-system/text-200";
import type {
  CambioCategoriaAction,
  CambioCategoriaState,
} from "@/lib/giocatori/admin/types";
import { scheda } from "./fixtures";
import { SchedaGiocatoreAdmin } from "./scheda-giocatore-admin";

const idle: CambioCategoriaAction = async () => ({ status: "idle" });

const effettiCambiati: CambioCategoriaState = {
  status: "error",
  reason: "effettiCambiati",
  message:
    "Nel frattempo gli effetti sono cambiati (iscrizioni o posti). Rileggi l'elenco aggiornato e conferma di nuovo.",
  at: 0,
};

/** w-admin-giocatore and w-admin-categoria-conferma, without data fetching. */
function Screen({
  variante = "completo",
  dialog,
  action = idle,
}: {
  variante?: Parameters<typeof scheda>[0];
  dialog?: "aperto" | "errore";
  action?: CambioCategoriaAction;
}) {
  return (
    <SchedaGiocatoreAdmin
      scheda={scheda(variante)}
      cambia={action}
      verifica={idle}
      initialAperto={dialog ? "F" : null}
      initialState={dialog === "errore" ? effettiCambiati : undefined}
    />
  );
}

const decorators: Meta<typeof Screen>["decorators"] = [
  (Story) => (
    <ToastProvider>
      <Story />
      <Toaster />
    </ToastProvider>
  ),
];

const meta = {
  title: "Admin/w-admin-giocatore",
  component: Screen,
  parameters: { nextjs: { appDirectory: true } },
  decorators,
  argTypes: {
    variante: {
      control: "select",
      options: ["completo", "bloccato", "senzaEffetti"],
    },
    dialog: { control: "select", options: [undefined, "aperto", "errore"] },
  },
} satisfies Meta<typeof Screen>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Data, registrations, points per season, «Cambia in femminile». */
export const Scheda: Story = {};
export const Testo200: Story = { decorators: [withText200] };

export const ConfermaApri: Story = {
  name: "Apre la conferma da tastiera",
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const bottone = await canvas.findByRole("button", {
      name: "Cambia in femminile",
    });
    bottone.focus();
    await userEvent.keyboard("{Enter}");
    await within(document.body).findByRole("alertdialog");
  },
};
