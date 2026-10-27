import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { EmailVerifyScreen } from "./email-verify-screen";

/** w-email-verify (BLVS-15): step 2 of 3 of the registration, every state. */
const meta = {
  title: "Registrazione/Conferma email",
  component: EmailVerifyScreen,
  parameters: { layout: "fullscreen" },
  args: {
    status: "waiting",
    email: "giulia.rossi@example.it",
    expiresAt: "2026-10-27T13:05:00Z",
    waitSeconds: 0,
  },
} satisfies Meta<typeof EmailVerifyScreen>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Link sent, waiting for the click; «Reinvia» unlocked. */
export const Default: Story = {};

/** Just sent: «Reinvia» locked with the countdown. */
export const ReinvioBloccato: Story = {
  args: { waitSeconds: 45 },
};

export const Loading: Story = {
  args: { status: "loading" },
};

export const Success: Story = {
  args: { status: "success" },
};

/** Link expired, already used or replaced by a newer one. */
export const SessionExpired: Story = {
  args: { status: "sessionExpired" },
};

/** Opened in another browser: the address is asked again. */
export const SessionExpiredSenzaEmail: Story = {
  args: { status: "sessionExpired", email: undefined },
};

/** Nobody to confirm in this browser. */
export const PermissionDenied: Story = {
  args: { status: "permissionDenied" },
};

/** A very long address at 200 % text: it wraps, nothing scrolls sideways. */
export const LongText: Story = {
  args: {
    email:
      "giulia.maria.francesca.rossi-bianchi.associazione-beach-volley@circolo-sportivo-lungomare-adriatico.example.it",
  },
  parameters: { text200: true },
};
