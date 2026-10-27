import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { withText200 } from "@/design-system/text-200";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./tabs";

const meta = {
  title: "UI/Tabs",
  component: Tabs,
  parameters: { layout: "padded" },
  args: { defaultValue: "gironi" },
} satisfies Meta<typeof Tabs>;

export default meta;
type Story = StoryObj<typeof meta>;

const SEZIONI = [
  { value: "gironi", label: "Gironi", testo: "Classifiche dei 4 gironi." },
  {
    value: "tabellone",
    label: "Tabellone",
    testo: "Eliminazione diretta dagli ottavi alla finale.",
  },
  { value: "squadre", label: "Squadre", testo: "32 squadre iscritte." },
];

const MOLTE = [
  ...SEZIONI,
  {
    value: "calendario",
    label: "Calendario",
    testo: "Orari di tutti i campi.",
  },
  { value: "campi", label: "Campi", testo: "6 campi in sabbia." },
  { value: "regolamento", label: "Regolamento", testo: "Regole del torneo." },
  { value: "iscrizioni", label: "Iscrizioni", testo: "Iscrizioni aperte." },
];

function Sezioni({
  sezioni,
  ...args
}: React.ComponentProps<typeof Tabs> & { sezioni: typeof SEZIONI }) {
  return (
    <Tabs {...args}>
      <TabsList aria-label="Sezioni del torneo">
        {sezioni.map((s) => (
          <TabsTrigger key={s.value} value={s.value}>
            {s.label}
          </TabsTrigger>
        ))}
      </TabsList>
      {sezioni.map((s) => (
        <TabsContent key={s.value} value={s.value}>
          {s.testo}
        </TabsContent>
      ))}
    </Tabs>
  );
}

export const Predefinito: Story = {
  render: (args) => <Sezioni {...args} sezioni={SEZIONI} />,
};

/** More tabs than fit at 390 px: the list scrolls, the page does not. */
export const MolteSchede: Story = {
  render: (args) => <Sezioni {...args} sezioni={MOLTE} />,
};

export const Disabilitata: Story = {
  render: (args) => (
    <Tabs {...args}>
      <TabsList aria-label="Sezioni del torneo">
        <TabsTrigger value="gironi">Gironi</TabsTrigger>
        <TabsTrigger value="tabellone" disabled>
          Tabellone
        </TabsTrigger>
        <TabsTrigger value="squadre">Squadre</TabsTrigger>
      </TabsList>
      <TabsContent value="gironi">Classifiche dei 4 gironi.</TabsContent>
      <TabsContent value="tabellone">Disponibile a fine gironi.</TabsContent>
      <TabsContent value="squadre">32 squadre iscritte.</TabsContent>
    </Tabs>
  ),
};

export const Testo200: Story = {
  decorators: [withText200],
  render: (args) => <Sezioni {...args} sezioni={MOLTE} />,
};
