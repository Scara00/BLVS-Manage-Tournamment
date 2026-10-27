import * as React from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { withText200 } from "@/design-system/text-200";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "./alert-dialog";
import { Button } from "./button";

const meta = {
  title: "UI/AlertDialog",
  component: AlertDialog,
  args: { defaultOpen: true },
} satisfies Meta<typeof AlertDialog>;

export default meta;
type Story = StoryObj<typeof meta>;

function EliminaTorneo({
  pending: initialPending = false,
  ...args
}: React.ComponentProps<typeof AlertDialog> & { pending?: boolean }) {
  const [open, setOpen] = React.useState(args.defaultOpen ?? false);
  const [pending, setPending] = React.useState(initialPending);

  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        if (!pending) setOpen(next);
      }}
    >
      <AlertDialogTrigger render={<Button variant="outline" />}>
        Elimina torneo
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Eliminare «Summer Cup 2026»?</AlertDialogTitle>
          <AlertDialogDescription>
            Squadre, calendario e risultati verranno eliminati.
            L&apos;operazione non si può annullare.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Annulla</AlertDialogCancel>
          <AlertDialogAction
            tone="destructive"
            loading={pending}
            loadingText="Eliminazione…"
            onClick={() => setPending(true)}
          >
            Elimina torneo
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

/** Focus opens on «Annulla», the safe action. Esc closes, a click outside does not. */
export const Predefinito: Story = {
  render: (args) => <EliminaTorneo {...args} />,
};

export const Caricamento: Story = {
  render: (args) => <EliminaTorneo {...args} pending />,
};

export const Testo200: Story = {
  decorators: [withText200],
  render: (args) => <EliminaTorneo {...args} />,
};
