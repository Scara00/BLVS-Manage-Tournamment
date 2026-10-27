import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { PlusIcon, Trash2Icon } from "lucide-react";
import { Button } from "./button";
import { FieldError } from "./field";

const meta = {
  title: "UI/Button",
  component: Button,
  args: { children: "Crea torneo" },
  argTypes: {
    variant: {
      control: "select",
      options: ["primary", "secondary", "destructive", "link"],
    },
    size: {
      control: "select",
      options: ["sm", "default", "campo", "icon", "icon-campo"],
    },
  },
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Varianti: Story = {
  render: (args) => (
    <div className="flex flex-wrap items-center gap-space-3">
      <Button {...args} variant="primary">
        Primario
      </Button>
      <Button {...args} variant="secondary">
        Secondario
      </Button>
      <Button {...args} variant="destructive">
        <Trash2Icon aria-hidden />
        Elimina
      </Button>
      <Button {...args} variant="link">
        Link
      </Button>
    </div>
  ),
};

/** On black: the inner white band of the focus ring stays visible. */
export const SuSfondoNero: Story = {
  render: (args) => (
    <div className="flex flex-wrap gap-space-3 bg-primary p-space-6">
      <Button {...args} variant="secondary">
        Secondario
      </Button>
    </div>
  ),
  play: async ({ canvas }) => {
    canvas.getByRole("button").focus();
  },
};

export const Dimensioni: Story = {
  render: (args) => (
    <div className="flex flex-wrap items-center gap-space-3">
      <Button {...args} size="sm">
        Piccolo
      </Button>
      <Button {...args} size="default">
        Predefinito
      </Button>
      <Button {...args} size="campo">
        Bordo campo
      </Button>
    </div>
  ),
};

export const ConIcona: Story = {
  args: {
    children: (
      <>
        <PlusIcon aria-hidden />
        Nuova squadra
      </>
    ),
  },
};

export const SoloIcona: Story = {
  args: {
    size: "icon",
    "aria-label": "Aggiungi squadra",
    children: <PlusIcon aria-hidden />,
  },
};

export const Focus: Story = {
  play: async ({ canvas }) => {
    canvas.getByRole("button").focus();
  },
};

export const Disabilitato: Story = {
  args: { disabled: true },
};

export const DisabilitatoConMotivo: Story = {
  args: {
    children: "Paga la quota",
    disabled: true,
    disabledReason: "Disponibile dopo la conferma dell'iscrizione",
  },
};

/** An action that failed: the message is linked to the button. */
export const Errore: Story = {
  render: (args) => (
    <div className="flex flex-col items-start gap-space-2">
      <Button {...args} aria-describedby="errore-salvataggio">
        Riprova a salvare
      </Button>
      <FieldError id="errore-salvataggio">
        Salvataggio non riuscito: controlla la connessione.
      </FieldError>
    </div>
  ),
};

export const Caricamento: Story = {
  args: { children: "Salva", loading: true },
};

export const Testo200: Story = {
  parameters: { text200: true },
  render: (args) => (
    <div className="flex max-w-xs flex-col items-start gap-space-3">
      <Button {...args}>Conferma l&apos;iscrizione della squadra</Button>
      <Button {...args} variant="secondary">
        Annulla
      </Button>
    </div>
  ),
};

export const BordoCampo: Story = {
  render: (args) => (
    <div className="flex flex-wrap items-center gap-space-3">
      <Button {...args} size="campo">
        +1 punto
      </Button>
      <Button {...args} size="icon-campo" aria-label="Aggiungi punto">
        <PlusIcon aria-hidden />
      </Button>
    </div>
  ),
};
