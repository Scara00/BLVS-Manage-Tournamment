import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { MinimalShell } from "@/components/layout/minimal-shell";
import { PageContainer } from "@/components/layout/page-container";
import { EMAIL_TAKEN_MESSAGE } from "@/lib/auth/messages";
import {
  CATEGORY_REQUIRED_MESSAGE,
  CONSENT_REQUIRED_MESSAGE,
  type SignupInput,
} from "@/lib/auth/signup";
import { NETWORK_ERROR_MESSAGE, SignupForm } from "./signup-form";
import type { SubmitSignup } from "./submit-signup";

const empty: SignupInput = {
  nome: "",
  cognome: "",
  email: "",
  password: "",
  categoria: "",
  consensoPrivacy: false,
};

const filled: SignupInput = {
  nome: "Giulia",
  cognome: "Colombo",
  email: "giulia.colombo@example.it",
  password: "una-password-lunga",
  categoria: "F",
  consensoPrivacy: true,
};

/** Never reaches the network: answers like the API after a short wait. */
const fakeSubmit: SubmitSignup = (input) =>
  new Promise((resolve) =>
    setTimeout(
      () =>
        resolve(
          input.email.trim().toLowerCase() === "giulia.colombo@example.it"
            ? {
                kind: "invalid",
                error: EMAIL_TAKEN_MESSAGE,
                fields: { email: EMAIL_TAKEN_MESSAGE },
              }
            : { kind: "ok", connesso: false, messaggio: "Account creato." },
        ),
      600,
    ),
  );

const meta = {
  title: "Pagine/Registrati",
  component: SignupForm,
  args: { submit: fakeSubmit, initialValues: empty },
  parameters: {
    layout: "fullscreen",
    nextjs: {
      appDirectory: true,
      navigation: { pathname: "/registrati" },
    },
  },
  decorators: [
    (Story) => (
      <div className="flex min-h-screen flex-col">
        <MinimalShell>
          <PageContainer
            title="Registrati"
            description="Crea il tuo account da giocatore: ti servirà per iscriverti alle tappe."
          >
            <Story />
          </PageContainer>
        </MinimalShell>
      </div>
    ),
  ],
} satisfies Meta<typeof SignupForm>;

export default meta;
type Story = StoryObj<typeof meta>;

const mobile = { viewport: { value: "mobile390", isRotated: false } };

/** Empty w-signup screen: consent not ticked, preview placeholder. */
export const Default: Story = {};

/** Every field wrong, email already registered with the «Accedi» link. */
export const FieldErrors: Story = {
  args: {
    initialValues: {
      ...filled,
      nome: "",
      password: "corta",
      categoria: "",
      consensoPrivacy: false,
    },
    initialErrors: {
      nome: "Campo obbligatorio.",
      email: EMAIL_TAKEN_MESSAGE,
      password: "Almeno 10 caratteri.",
      categoria: CATEGORY_REQUIRED_MESSAGE,
      consensoPrivacy: CONSENT_REQUIRED_MESSAGE,
    },
  },
};

/** Submit in flight: the button is busy, values stay. */
export const Loading: Story = {
  args: { initialValues: filled, initialLoading: true },
};

/** The request failed: alert with «Riprova», values stay. */
export const Network: Story = {
  args: { initialValues: filled, initialFormError: NETWORK_ERROR_MESSAGE },
};

/** No connection: notice, submit blocked with its reason, values stay. */
export const Offline: Story = {
  args: { initialValues: filled, offline: true },
};

/** Very long names and email wrap in the fields and the preview. */
export const LongText: Story = {
  args: {
    initialValues: {
      ...filled,
      nome: "Maria Antonietta Giuseppina",
      cognome: "Della Valle Sant'Ambrogio Bartolomei-Castelfranco",
      email:
        "maria.antonietta.giuseppina.dellavalle.santambrogio@un-dominio-molto-lungo.example.it",
    },
  },
  globals: mobile,
};

/** 200 % text at 390 px (WCAG 1.4.4 / 1.4.10): no horizontal scroll. */
export const Text200: Story = {
  args: {
    initialValues: filled,
    initialErrors: { email: EMAIL_TAKEN_MESSAGE },
  },
  parameters: { text200: true },
  globals: mobile,
};
