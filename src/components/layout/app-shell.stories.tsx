import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { RootFontSize } from "@/test/root-font-size";
import {
  ResponsiveTable,
  type ResponsiveTableColumn,
} from "../responsive-table/responsive-table";
import { AppShell } from "./app-shell";
import { PageContainer } from "./page-container";
import { PlayerNav } from "./player-nav";

const signOut = async () => ({ error: null });

type Standing = { position: number; pair: string; points: number };

const columns: ResponsiveTableColumn<Standing>[] = [
  {
    key: "position",
    header: "Posizione",
    numeric: true,
    align: "start",
    width: "18%",
  },
  { key: "pair", header: "Coppia", rowHeader: true },
  { key: "points", header: "Punti", numeric: true, width: "16%" },
];

const standings: Standing[] = [
  { position: 1, pair: "Rossi / Bianchi", points: 420 },
  { position: 2, pair: "Esposito / Romano", points: 385 },
  { position: 3, pair: "Colombo / Ricci", points: 310 },
];

function DemoPage({ title = "Classifica" }: { title?: string }) {
  return (
    <PageContainer
      title={title}
      eyebrow="Circuito 2026"
      description="La classifica generale del circuito, aggiornata dopo ogni tappa."
    >
      <ResponsiveTable
        caption="Classifica generale"
        columns={columns}
        rows={standings}
        getRowKey={(r) => r.pair}
        cardBadgeKey="position"
      />
    </PageContainer>
  );
}

const meta = {
  title: "Layout/AppShell",
  component: AppShell,
  parameters: {
    layout: "fullscreen",
    nextjs: {
      appDirectory: true,
      navigation: { pathname: "/classifica" },
    },
  },
  args: {
    variant: "player",
    signOut,
    children: <DemoPage />,
  },
  decorators: [
    (Story) => (
      <div className="flex min-h-screen flex-col">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof AppShell>;

export default meta;
type Story = StoryObj<typeof meta>;

const mobile = { viewport: { value: "mobile390", isRotated: false } };

export const Giocatore: Story = {};

export const GiocatoreMobile: Story = { globals: mobile };

export const Admin: Story = {
  args: { variant: "admin", children: <DemoPage title="Dashboard" /> },
  parameters: {
    nextjs: { appDirectory: true, navigation: { pathname: "/admin" } },
  },
};

export const AdminMobile: Story = {
  ...Admin,
  globals: mobile,
};

export const TestoLungo: Story = {
  args: {
    nav: (
      <PlayerNav
        signOut={signOut}
        primary={[
          { href: "/tappe", label: "Calendario completo delle tappe" },
          { href: "/live", label: "Risultati in diretta dai campi" },
          { href: "/classifica", label: "Classifica generale del circuito" },
        ]}
      />
    ),
    children: (
      <DemoPage title="Classifica generale del circuito nazionale di beach volley 2026, categoria maschile open" />
    ),
  },
};

export const Testo200: Story = {
  decorators: [
    (Story) => (
      <RootFontSize size="200%">
        <Story />
      </RootFontSize>
    ),
  ],
};

export const Testo200Mobile: Story = { ...Testo200, globals: mobile };
