import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { ResetLinkInvalid } from "./reset-link-invalid";
import { ResetPasswordFormView } from "./reset-password-form";
import { mobile, withPasswordShell } from "./shell-decorator";

/** w-reset: the new password with its ✓/✕ requirements, in every state. */
const meta = {
  title: "Accesso/Reimposta password",
  component: ResetPasswordFormView,
  parameters: {
    layout: "fullscreen",
    nextjs: {
      appDirectory: true,
      navigation: { pathname: "/reimposta-password" },
    },
  },
  decorators: [withPasswordShell],
  args: { status: "idle" },
} satisfies Meta<typeof ResetPasswordFormView>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

/** Part of the requirements met: ✓ and ✕ with the outcome in words. */
export const RequisitiParziali: Story = {
  args: { defaultPassword: "spiaggia", defaultConfirmation: "spiaggia" },
};

export const ErroriNeiCampi: Story = {
  args: {
    defaultPassword: "spiaggia",
    defaultConfirmation: "spiagga",
    fieldErrors: {
      password: "La password non rispetta i requisiti: almeno un numero.",
      conferma: "Le due password non coincidono.",
    },
  },
};

export const InCaricamento: Story = {
  args: {
    status: "loading",
    defaultPassword: "Spiaggia-2026",
    defaultConfirmation: "Spiaggia-2026",
  },
};

export const ErroreDiRete: Story = {
  args: {
    status: "network",
    defaultPassword: "Spiaggia-2026",
    defaultConfirmation: "Spiaggia-2026",
  },
};

export const Offline: Story = {
  args: {
    status: "offline",
    defaultPassword: "Spiaggia-2026",
    defaultConfirmation: "Spiaggia-2026",
  },
};

/** success: saved; the page then goes home with a toast. */
export const Salvata: Story = {
  args: {
    status: "success",
    message:
      "Password aggiornata. Abbiamo chiuso le sessioni aperte sugli altri dispositivi.",
  },
};

/** sessionExpired: the link is expired or already used. */
export const LinkScaduto: Story = {
  render: () => <ResetLinkInvalid />,
};

/** longText: 200 % text at 390 px with an error message. */
export const TestoLungo: Story = {
  args: {
    status: "error",
    message:
      "Non siamo riusciti a salvare la password. Riprova: se il problema continua, chiedi un nuovo link dalla pagina «Password dimenticata».",
    defaultPassword: "una-password-di-prova-molto-lunga-ma-senza-numeri",
  },
  parameters: { text200: true },
  globals: mobile,
};
