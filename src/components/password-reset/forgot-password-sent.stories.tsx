import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { ForgotPasswordSent } from "./forgot-password-sent";
import { LONG_EMAIL, mobile, withPasswordShell } from "./shell-decorator";

const ok = async () => ({ kind: "ok", data: {} }) as const;

/** w-forgot-sent: the same answer for registered and unknown addresses. */
const meta = {
  title: "Accesso/Email inviata",
  component: ForgotPasswordSent,
  parameters: {
    layout: "fullscreen",
    nextjs: {
      appDirectory: true,
      navigation: { pathname: "/password-dimenticata" },
    },
  },
  decorators: [withPasswordShell],
  args: { email: "giocatore@example.it", onResend: ok },
} satisfies Meta<typeof ForgotPasswordSent>;

export default meta;
type Story = StoryObj<typeof meta>;

/** success: just sent, «Invia di nuovo» blocked with the countdown. */
export const Default: Story = {};

/** The 60 s are over: «Invia di nuovo» is available. */
export const InvioDisponibile: Story = { args: { cooldownSeconds: 0 } };

export const InCaricamento: Story = {
  args: { cooldownSeconds: 0, initialStatus: "loading" },
};

export const ErroreDiRete: Story = {
  args: { cooldownSeconds: 0, initialStatus: "network" },
};

export const Offline: Story = {
  args: { cooldownSeconds: 0, initialStatus: "offline" },
};

export const ErroreDelServer: Story = {
  args: {
    cooldownSeconds: 0,
    initialStatus: "error",
    initialMessage: "Troppi tentativi. Riprova tra qualche minuto.",
  },
};

/** longText: a very long address wraps; 200 % text at 390 px. */
export const TestoLungo: Story = {
  args: { email: LONG_EMAIL },
  parameters: { text200: true },
  globals: mobile,
};
