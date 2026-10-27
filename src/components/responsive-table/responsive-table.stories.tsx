import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { RootFontSize } from "@/test/root-font-size";
import {
  ResponsiveTable,
  type ResponsiveTableColumn,
} from "./responsive-table";

type Standing = {
  position: number;
  pair: string;
  stages: number;
  points: number;
};

const columns: ResponsiveTableColumn<Standing>[] = [
  {
    key: "position",
    header: "Posizione",
    numeric: true,
    align: "start",
    width: "18%",
  },
  { key: "pair", header: "Coppia", rowHeader: true },
  { key: "stages", header: "Tappe giocate", numeric: true, width: "20%" },
  { key: "points", header: "Punti", numeric: true, width: "16%" },
];

const rows: Standing[] = [
  { position: 1, pair: "Rossi / Bianchi", stages: 3, points: 420 },
  { position: 2, pair: "Esposito / Romano", stages: 3, points: 385 },
  { position: 3, pair: "Colombo / Ricci", stages: 2, points: 310 },
  { position: 4, pair: "Marino / Greco", stages: 3, points: 295 },
];

const longRows: Standing[] = [
  ...rows.slice(0, 2),
  {
    position: 3,
    pair: "Bruno-Gallo de Santis Mancinelli / Conti Lombardi Bartolomei-Fioravanti",
    stages: 2,
    points: 310,
  },
  {
    position: 4,
    pair: "Supercalifragilistichespiralidosoeccezionalissimo / Precipitevolissimevolmente",
    stages: 3,
    points: 295,
  },
];

const meta = {
  title: "UI/ResponsiveTable",
  component: ResponsiveTable<Standing>,
  parameters: { layout: "padded" },
  args: {
    caption: "Classifica generale",
    columns,
    rows,
    getRowKey: (r: Standing) => r.pair,
    cardBadgeKey: "position",
  },
} satisfies Meta<typeof ResponsiveTable<Standing>>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Desktop1440: Story = {
  globals: { viewport: { value: "desktop1440", isRotated: false } },
};

export const Mobile390: Story = {
  globals: { viewport: { value: "mobile390", isRotated: false } },
};

export const CaptionNascosta: Story = { args: { captionHidden: true } };

export const TestoLungo: Story = { args: { rows: longRows } };

export const Testo200: Story = {
  args: { rows: longRows },
  decorators: [
    (Story) => (
      <RootFontSize size="200%">
        <Story />
      </RootFontSize>
    ),
  ],
};
