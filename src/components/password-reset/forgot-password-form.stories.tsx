import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { ForgotPasswordFormView } from "./forgot-password-form";
import { LONG_EMAIL, mobile, withPasswordShell } from "./shell-decorator";

/** w-forgot: one state per story, so axe checks each of them. */
const meta = {
  title: "Accesso/Password dimenticata",
  component: ForgotPasswordFormView,
  parameters: {
    layout: "fullscreen",
    nextjs: {
      appDirectory: true,
      navigation: { pathname: "/password-dimenticata" },
    },
  },
  decorators: [withPasswordShell],
  args: { status: "idle" },
} satisfies Meta<typeof ForgotPasswordFormView>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

/** fieldErrors: client or server validation of the email. */
export const ErroriNeiCampi: Story = {
  args: {
    defaultEmail: "nome@",
    emailError: "Inserisci un'email valida, es. nome@esempio.it.",
  },
};

/** loading: the button keeps focus, shows the spinner and blocks resubmits. */
export const InCaricamento: Story = {
  args: { status: "loading", defaultEmail: "giocatore@example.it" },
};

export const ErroreDiRete: Story = {
  args: { status: "network", defaultEmail: "giocatore@example.it" },
};

export const Offline: Story = {
  args: { status: "offline", defaultEmail: "giocatore@example.it" },
};

/** A server message, e.g. too many attempts (429). */
export const ErroreDelServer: Story = {
  args: {
    status: "error",
    message: "Troppi tentativi. Riprova tra qualche minuto.",
    defaultEmail: "giocatore@example.it",
  },
};

/** sessionExpired: back here from a reset link that is dead. */
export const LinkScaduto: Story = { args: { linkExpired: true } };

/** longText: long address and 200 % text at 390 px, no horizontal scroll. */
export const TestoLungo: Story = {
  args: {
    defaultEmail: LONG_EMAIL,
    linkExpired: true,
    status: "error",
    message:
      "Servizio momentaneamente non disponibile. Riprova tra qualche minuto: se il problema continua scrivi all'organizzazione del torneo.",
  },
  parameters: { text200: true },
  globals: mobile,
};
