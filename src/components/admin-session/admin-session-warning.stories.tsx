import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { useState } from "react";
import { ToastProvider, Toaster, useToast } from "@/components/ui/toast";
import { withText200 } from "@/design-system/text-200";
import { initialSignOutState } from "@/lib/auth/sign-out-state";
import { AdminSessionWarning } from "./admin-session-warning";
import { ADMIN_SESSION_MESSAGES as M } from "./messages";

const noopSignOut = async () => initialSignOutState;

/**
 * The warning before the admin session closes (BLVS-18). Open by default so
 * axe audits the open state; «Prolunga sessione» closes it with the toast.
 */
function Demo({
  secondsLeft = 120,
  error = null,
  pending = false,
  expired = false,
}: {
  secondsLeft?: number;
  error?: string | null;
  pending?: boolean;
  expired?: boolean;
}) {
  const [open, setOpen] = useState(true);
  const toast = useToast();
  return (
    <>
      {/* The page behind the dialog (the dialog itself is portalled). */}
      <p>Area amministrazione · Tappe</p>
      <AdminSessionWarning
        open={open}
        secondsLeft={secondsLeft}
        error={error}
        pending={pending}
        expired={expired}
        signOut={noopSignOut}
        onExtend={() => {
          setOpen(false);
          toast.add({
            title: M.extendedTitle,
            description: M.extendedUntil("11:30"),
          });
        }}
      />
    </>
  );
}

const meta = {
  title: "Admin/Sessione/Avviso di scadenza",
  component: Demo,
  decorators: [
    (Story) => (
      <ToastProvider>
        <Story />
        <Toaster />
      </ToastProvider>
    ),
  ],
} satisfies Meta<typeof Demo>;

export default meta;
type Story = StoryObj<typeof meta>;

/** 2 minutes before the deadline: focus on «Prolunga sessione». */
export const Avviso: Story = {};

export const UltimiSecondi: Story = { args: { secondsLeft: 25 } };

export const Prolungamento: Story = { args: { pending: true } };

export const ErroreProlungamento: Story = {
  args: { secondsLeft: 74, error: M.extendError },
};

/** The deadline passed: drafts saved, the page is about to change. */
export const Scaduta: Story = { args: { secondsLeft: 0, expired: true } };

export const Testo200: Story = { decorators: [withText200] };
