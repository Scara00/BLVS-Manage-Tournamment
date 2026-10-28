import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import {
  CANCELLA_ACCOUNT_MESSAGES,
  type CancellaAccountAction,
} from "@/lib/account/types";
import { CancellaAccount } from "./cancella-account";

/** Refuses like `cancella_account()` with a stage in progress. */
const tappaInCorso: CancellaAccountAction = async () => {
  await new Promise((resolve) => setTimeout(resolve, 600));
  return { status: "error", message: CANCELLA_ACCOUNT_MESSAGES.tappaInCorso };
};

/** Never settles: the dialog stays in its «Cancellazione…» state. */
const inAttesaPerSempre: CancellaAccountAction = () => new Promise(() => {});

const meta = {
  title: "Profilo/Cancella account",
  component: CancellaAccount,
  args: { action: tappaInCorso },
  parameters: {
    layout: "padded",
    nextjs: { appDirectory: true, navigation: { pathname: "/profilo" } },
  },
} satisfies Meta<typeof CancellaAccount>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The section on w-profilo: what happens is said before asking. */
export const Sezione: Story = {};

/** The confirmation dialog, tick box still empty. */
export const Conferma: Story = { args: { defaultOpen: true } };

/** Refused: a stage is in progress (message in the dialog). */
export const TappaInCorso: Story = {
  args: {
    defaultOpen: true,
    initialState: {
      status: "error",
      message: CANCELLA_ACCOUNT_MESSAGES.tappaInCorso,
    },
  },
};

/** Refused: an admin account. */
export const AccountAdmin: Story = {
  args: {
    defaultOpen: true,
    initialState: {
      status: "error",
      message: CANCELLA_ACCOUNT_MESSAGES.accountAdmin,
    },
  },
};

/** The session ended meanwhile: the way back in is a link. */
export const SessioneScaduta: Story = {
  args: {
    initialState: {
      status: "sessionExpired",
      message: CANCELLA_ACCOUNT_MESSAGES.sessionExpired,
    },
  },
};

export const InCorso: Story = { args: { action: inAttesaPerSempre } };
