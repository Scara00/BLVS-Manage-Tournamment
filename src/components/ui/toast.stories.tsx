import * as React from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { withText200 } from "@/design-system/text-200";
import { Button } from "./button";
import { ToastProvider, Toaster, useToast } from "./toast";

function Demo({ persistent = true }: { persistent?: boolean }) {
  const toast = useToast();
  const shown = React.useRef(false);

  const elimina = React.useCallback(
    (timeout?: number) =>
      toast.add({
        title: "Squadra eliminata",
        description: "I Bagnini è stata rimossa dal girone A.",
        timeout,
        actionProps: {
          children: "Annulla",
          onClick: () =>
            toast.add({
              title: "Eliminazione annullata",
              description: "I Bagnini è di nuovo nel girone A.",
            }),
        },
      }),
    [toast],
  );

  // One toast that never expires, so the open state can be audited.
  React.useEffect(() => {
    if (!persistent || shown.current) return;
    shown.current = true;
    elimina(0);
  }, [elimina, persistent]);

  return (
    <div className="flex flex-wrap gap-space-2">
      <Button onClick={() => elimina()}>Elimina squadra</Button>
      <Button
        variant="secondary"
        onClick={() =>
          toast.add({
            title: "Risultato salvato",
            description: "Girone A · I Bagnini 21 – 18 Sabbia Mobile",
          })
        }
      >
        Salva risultato
      </Button>
    </div>
  );
}

const meta = {
  title: "UI/Toast",
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

/** Toast with an «Annulla» action. Hover or focus pauses the 6 s timer. */
export const ConAzione: Story = {};

/** No toast on load: trigger them from the keyboard. */
export const Vuoto: Story = { args: { persistent: false } };

export const Testo200: Story = { decorators: [withText200] };
