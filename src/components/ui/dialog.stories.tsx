import * as React from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { withText200 } from "@/design-system/text-200";
import { Button } from "./button";
import {
  Dialog,
  DialogAction,
  DialogBody,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "./dialog";

const meta = {
  title: "UI/Dialog",
  component: Dialog,
  args: { defaultOpen: true },
} satisfies Meta<typeof Dialog>;

export default meta;
type Story = StoryObj<typeof meta>;

const REGOLE = [
  "Ogni squadra è composta da due giocatori e può iscrivere una riserva.",
  "Le partite dei gironi si giocano al meglio di un set ai 21 punti.",
  "Il cambio campo avviene ogni 7 punti nei set ai 21 e ogni 5 nel tie-break.",
  "Ogni squadra ha diritto a un time-out per set della durata di 30 secondi.",
  "In caso di parità nel girone conta il quoziente punti, poi lo scontro diretto.",
  "La squadra che non si presenta entro 10 minuti dall'orario perde a tavolino.",
  "Il tabellone a eliminazione diretta si gioca al meglio dei tre set.",
  "L'arbitro di campo ha l'ultima parola su ogni azione contestata.",
  "Le classifiche si aggiornano al termine di ogni partita confermata.",
  "Gli orari possono cambiare: controlla sempre il tabellone ufficiale.",
];

export const Corto: Story = {
  render: (args) => (
    <Dialog {...args}>
      <DialogTrigger render={<Button />}>Modifica squadra</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Modifica squadra</DialogTitle>
          <DialogDescription>
            Aggiorna il nome visibile nel tabellone.
          </DialogDescription>
        </DialogHeader>
        <DialogBody>
          <label className="flex flex-col gap-space-2 text-sm font-medium">
            Nome squadra
            <input
              defaultValue="I Bagnini"
              className="h-10 border border-input px-space-3 text-base font-normal outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            />
          </label>
        </DialogBody>
        <DialogFooter>
          <DialogClose render={<Button variant="secondary" />}>
            Annulla
          </DialogClose>
          <DialogAction>Salva</DialogAction>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  ),
};

function Regolamento(args: React.ComponentProps<typeof Dialog>) {
  return (
    <Dialog {...args}>
      <DialogTrigger render={<Button />}>Leggi il regolamento</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Regolamento del torneo</DialogTitle>
          <DialogDescription>
            Solo il testo scorre: le azioni restano sempre visibili.
          </DialogDescription>
        </DialogHeader>
        <DialogBody>
          <ol className="flex list-decimal flex-col gap-stack-sm pl-space-5">
            {[...REGOLE, ...REGOLE].map((regola, i) => (
              <li key={i}>{regola}</li>
            ))}
          </ol>
        </DialogBody>
        <DialogFooter>
          <DialogClose render={<Button variant="secondary" />}>
            Chiudi
          </DialogClose>
          <DialogClose render={<DialogAction />}>Ho capito</DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Long body: it scrolls, header and footer stay put. */
export const Lungo: Story = {
  render: (args) => <Regolamento {...args} />,
};

export const Distruttivo: Story = {
  render: (args) => (
    <Dialog {...args}>
      <DialogTrigger render={<Button variant="secondary" />}>
        Elimina girone
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Eliminare il girone A?</DialogTitle>
          <DialogDescription>
            Le 4 partite già giocate e i relativi punteggi andranno persi.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose render={<Button variant="secondary" />}>
            Annulla
          </DialogClose>
          <DialogAction tone="destructive">Elimina girone</DialogAction>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  ),
};

/** While the request is pending the dialog cannot be dismissed. */
function EliminazioneInCorso({
  pending: initialPending = true,
  ...args
}: React.ComponentProps<typeof Dialog> & { pending?: boolean }) {
  const [open, setOpen] = React.useState(args.defaultOpen ?? false);
  const [pending, setPending] = React.useState(initialPending);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!pending) setOpen(next);
      }}
    >
      <DialogTrigger render={<Button variant="secondary" />}>
        Elimina girone
      </DialogTrigger>
      <DialogContent showCloseButton={!pending}>
        <DialogHeader>
          <DialogTitle>Eliminare il girone A?</DialogTitle>
          <DialogDescription>
            Le 4 partite già giocate e i relativi punteggi andranno persi.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose
            disabled={pending}
            render={<Button variant="secondary" />}
          >
            Annulla
          </DialogClose>
          <DialogAction
            tone="destructive"
            loading={pending}
            loadingText="Eliminazione…"
            onClick={() => setPending(true)}
          >
            Elimina girone
          </DialogAction>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export const Caricamento: Story = {
  render: (args) => <EliminazioneInCorso {...args} />,
};

export const Testo200: Story = {
  decorators: [withText200],
  render: (args) => <Regolamento {...args} />,
};
