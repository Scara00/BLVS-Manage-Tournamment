import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Loader2Icon, RadioIcon, TriangleAlertIcon } from "lucide-react";
import { Badge } from "./badge";

const meta = {
  title: "UI/Badge",
  component: Badge,
  args: { children: "Bozza" },
} satisfies Meta<typeof Badge>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Toni: Story = {
  render: () => (
    <div className="flex max-w-md flex-wrap gap-space-2">
      <Badge>Neutro</Badge>
      <Badge variant="success">Confermata</Badge>
      <Badge variant="error">Rifiutata</Badge>
      <Badge variant="warning">In attesa</Badge>
      <Badge variant="info">Nuovo</Badge>
      <Badge variant="live" icon={<RadioIcon />}>
        Live
      </Badge>
      <Badge variant="reg-draft">Bozza</Badge>
      <Badge variant="reg-open">Iscrizioni aperte</Badge>
      <Badge variant="reg-closed">Iscrizioni chiuse</Badge>
      <Badge variant="reg-cancelled">Annullato</Badge>
    </div>
  ),
};

export const Pillola: Story = {
  args: { shape: "pill", children: "12 squadre" },
};

/** Icon only: the label is read by screen readers. */
export const SoloIcona: Story = {
  render: () => (
    <Badge variant="live" icon={<RadioIcon />} label="In diretta" />
  ),
};

export const Errore: Story = {
  render: () => (
    <Badge variant="error" icon={<TriangleAlertIcon />}>
      Pagamento non riuscito
    </Badge>
  ),
};

export const Caricamento: Story = {
  render: () => (
    <Badge
      aria-busy
      icon={<Loader2Icon className="animate-spin motion-reduce:animate-none" />}
    >
      Caricamento…
    </Badge>
  ),
};

export const Testo200: Story = {
  parameters: { text200: true },
  render: () => (
    <div className="flex max-w-xs flex-wrap gap-space-2">
      <Badge variant="reg-open">Iscrizioni aperte</Badge>
      <Badge variant="live">Live</Badge>
    </div>
  ),
};
