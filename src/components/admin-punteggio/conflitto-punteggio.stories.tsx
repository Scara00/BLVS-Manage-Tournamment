import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import type {
  NomiCoppie,
  PunteggioUfficiale,
  SetConflitto,
} from "@/lib/punteggi/conflitto/rileva";
import { ConflittoPunteggio } from "./conflitto-punteggio";

const salvato: PunteggioUfficiale = {
  versione: 3,
  sets: [{ a: 21, b: 18 }],
  autore: "Giulia Neri",
  salvatoIl: "2026-06-12T12:05:00Z",
};

type DemoProps = {
  salvato: PunteggioUfficiale;
  mio: SetConflitto[];
  coppie: NomiCoppie;
  defaultOpen?: boolean;
  defaultPasso?: "scelta" | "conferma";
  pending?: boolean;
};

/** The dialog behind a «Salva» button, so the keyboard can reopen it. */
function Demo({ defaultOpen = true, pending = false, ...props }: DemoProps) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="p-inset">
      <Button onClick={() => setOpen(true)}>Salva</Button>
      <ConflittoPunteggio
        {...props}
        open={open}
        onOpenChange={setOpen}
        pending={pending}
        onTieniSalvato={() => setOpen(false)}
        onSovrascrivi={() => setOpen(false)}
      />
    </div>
  );
}

/**
 * w-admin-conflitto: another admin saved the same match first. Open by
 * default so axe sees the dialog.
 */
const meta = {
  title: "Admin/Conflitto punteggio",
  component: Demo,
  args: {
    salvato,
    mio: [{ a: 21, b: 19 }],
    coppie: { a: "Rossi/Bianchi", b: "Verdi/Moretti" },
    defaultOpen: true,
  },
} satisfies Meta<typeof Demo>;

export default meta;
type Story = StoryObj<typeof meta>;

/** One digit differs: underlined on tape and listed in words. */
export const Conflitto: Story = {};

/** «Sovrascrivi» asks for a second confirmation. */
export const ConfermaSovrascrittura: Story = {
  args: { defaultPasso: "conferma" },
};

/** The overwrite is in flight. */
export const Loading: Story = {
  args: { defaultPasso: "conferma", pending: true },
};

/** Long names and three sets: names wrap, scores stay on one line. */
export const LongText: Story = {
  args: {
    salvato: {
      versione: 7,
      sets: [
        { a: 21, b: 18 },
        { a: 19, b: 21 },
        { a: 15, b: 13 },
      ],
      autore: "Maria Antonietta Bevilacqua-Santangelo",
      salvatoIl: "2026-06-12T16:42:00Z",
    },
    mio: [
      { a: 21, b: 18 },
      { a: 21, b: 19 },
    ],
    coppie: {
      a: "Carlotta Dell'Acqua-Ferraris / Benedetta Montecchi-Lombardo",
      b: "Francesca Bevilacqua-Santangelo / Ludovica Castiglioni-Rinaldi",
    },
  },
};
