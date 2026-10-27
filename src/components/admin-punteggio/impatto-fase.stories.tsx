import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { PUNTEGGIO_MESSAGES } from "@/lib/punteggi/state";
import type { SceltaImpatto } from "@/lib/punteggi/correzione/types";
import { ImpattoFase } from "./impatto-fase";
import { impattoFase } from "./stories-data";

type DemoProps = Omit<
  React.ComponentProps<typeof ImpattoFase>,
  "open" | "onOpenChange" | "onScegli"
>;

/** The dialog behind «Conferma e salva», so the keyboard can reopen it. */
function Demo(props: DemoProps) {
  const [open, setOpen] = useState(true);
  const [scelta, setScelta] = useState<SceltaImpatto | null>(null);
  return (
    <div className="flex flex-col items-start gap-stack p-inset">
      <Button onClick={() => setOpen(true)}>Conferma e salva</Button>
      {scelta ? <p role="status">Scelta: {scelta}</p> : null}
      <ImpattoFase
        {...props}
        open={open}
        onOpenChange={setOpen}
        onScegli={(s) => {
          setScelta(s);
          setOpen(false);
        }}
      />
    </div>
  );
}

const meta = {
  title: "Admin/Punteggio/Impatto sulla fase",
  component: Demo,
  args: { impatto: impattoFase, pending: false, online: true },
} satisfies Meta<typeof Demo>;

export default meta;
type Story = StoryObj<typeof meta>;

/** w-admin-impatto-fase: preview, scores lost, the box inside «Rigenera». */
export const Scelta: Story = {};

/** The next phase has no score yet: «Rigenera» needs no tick. */
export const SenzaPunteggi: Story = {
  args: {
    impatto: {
      punteggiPersi: 0,
      partite: impattoFase.partite.map((p) => ({ ...p, sets: [] })),
    },
  },
};

/** fieldErrors: «Rigenera» without the tick, error next to the box. */
export const SenzaSpunta: Story = {
  args: {
    erroreConferma: "Spunta la casella per confermare che perdi 1 punteggio.",
  },
};

/** loading: «Rigenera» in flight. */
export const Rigenerazione: Story = {
  args: { pending: true, inCorso: "rigenera" },
};

/** network: the choice could not be sent; the dialog stays open. */
export const SenzaRete: Story = {
  args: { errore: PUNTEGGIO_MESSAGES.network },
};

/** The next phase changed while the dialog was open. */
export const FaseCambiata: Story = {
  args: {
    avviso:
      "Nel frattempo la fase successiva è cambiata: ora si perde 1 punteggio. Controlla l'elenco e scegli di nuovo.",
  },
};

export const Offline: Story = { args: { online: false } };

export const Testo200: Story = { parameters: { text200: true } };
