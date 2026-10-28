import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import {
  INVALID_CREDENTIALS_MESSAGE,
  rateLimitedLoginMessage,
} from "@/lib/auth/messages";
import {
  initialSignInState,
  LOGIN_UNAVAILABLE_MESSAGE,
  PERMISSION_DENIED_MESSAGE,
} from "@/lib/auth/sign-in-state";
import { MinimalShell } from "@/components/layout/minimal-shell";
import { LoginFormView } from "./login-form-view";

const retryAt = new Date(Date.now() + 12 * 60_000);

/** w-login in every state the criteria ask for, inside its page frame. */
const meta = {
  title: "Accesso/Modulo di accesso",
  component: LoginFormView,
  parameters: { layout: "fullscreen" },
  decorators: [
    (Story) => (
      <MinimalShell back={false}>
        <Story />
      </MinimalShell>
    ),
  ],
  args: { state: initialSignInState, formAction: () => {} },
} satisfies Meta<typeof LoginFormView>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const FieldErrors: Story = {
  args: {
    state: {
      status: "fieldErrors",
      fieldErrors: {
        email: "Inserisci un'email valida, es. nome@esempio.it.",
        password: "Campo obbligatorio.",
      },
      email: "mario.rossi",
      attempt: 1,
    },
  },
};

export const CredenzialiErrate: Story = {
  args: {
    state: {
      status: "invalid",
      message: INVALID_CREDENTIALS_MESSAGE,
      email: "mario.rossi@esempio.it",
      attempt: 1,
    },
  },
};

export const AccessoSospeso: Story = {
  args: {
    state: {
      status: "rateLimited",
      message: rateLimitedLoginMessage(retryAt, 12 * 60),
      retryAt: retryAt.toISOString(),
      email: "mario.rossi@esempio.it",
      attempt: 6,
    },
  },
};

export const PermissionDenied: Story = {
  args: {
    state: {
      status: "permissionDenied",
      message: PERMISSION_DENIED_MESSAGE,
      email: "mario.rossi@esempio.it",
      attempt: 1,
    },
    returnTo: "/admin/tappe",
    signOutAction: () => {},
  },
};

export const NonDisponibile: Story = {
  args: {
    state: {
      status: "unavailable",
      message: LOGIN_UNAVAILABLE_MESSAGE,
      attempt: 1,
    },
  },
};

export const Loading: Story = {
  args: { pending: true },
};

export const SessionExpired: Story = {
  args: {
    returnTo: "/classifica",
    notice: { kind: "scaduta", destination: "Classifica" },
  },
};

export const Uscita: Story = {
  args: { notice: { kind: "uscita", draftsCleared: 2 } },
};

export const Success: Story = {
  args: { pending: true, redirectingTo: "Classifica" },
};

export const Text200: Story = {
  args: {
    state: {
      status: "invalid",
      message: INVALID_CREDENTIALS_MESSAGE,
      email: "mario.rossi@esempio.it",
      attempt: 1,
    },
    notice: { kind: "scaduta", destination: "Admin · Tappe" },
  },
  parameters: { text200: true },
};
