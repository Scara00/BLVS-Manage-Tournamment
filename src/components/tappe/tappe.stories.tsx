import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { demoTappeGiocatore } from "@/lib/demo/tournament";
import { toTappeGiocatore, type TappaGiocatoreRow } from "@/lib/tappe/format";
import { TappeElenco } from "./tappe-elenco";
import { TappeLoading, TappeSessioneScaduta } from "./tappe-stati";

const { tappe: righe, posti, categoria } = demoTappeGiocatore;

const longRows: TappaGiocatoreRow[] = righe.map((row, i) =>
  i === 1
    ? {
        ...row,
        nome: "Tappa 2 · Rimini Marina Centro Internazionale Beach Volley Superfinale",
        luogo:
          "Rimini, Bagno 26 «Spiaggia dei Campioni» presso il Lungomare Augusto, campi centrali e secondari",
      }
    : row,
);

type Stato =
  | "ready"
  | "loading"
  | "empty"
  | "offline"
  | "sessionExpired"
  | "longText"
  | "anonimo";

/** The w-tappe screen body in every state, without data fetching. */
function TappeScreen({ stato }: { stato: Stato }) {
  if (stato === "loading") return <TappeLoading />;
  if (stato === "sessionExpired") return <TappeSessioneScaduta />;
  const rows = stato === "longText" ? longRows : stato === "empty" ? [] : righe;
  const anonimo = stato === "anonimo";
  return (
    <TappeElenco
      tappe={toTappeGiocatore(rows, posti, anonimo ? null : categoria)}
      connesso={!anonimo}
      offline={stato === "offline"}
    />
  );
}

const meta = {
  title: "Tappe/Elenco",
  component: TappeScreen,
  args: { stato: "ready" },
  argTypes: {
    stato: {
      control: "select",
      options: [
        "ready",
        "loading",
        "empty",
        "offline",
        "sessionExpired",
        "longText",
        "anonimo",
      ],
    },
  },
  parameters: { layout: "padded" },
} satisfies Meta<typeof TappeScreen>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Loading: Story = { args: { stato: "loading" } };

export const Empty: Story = { args: { stato: "empty" } };

export const Offline: Story = { args: { stato: "offline" } };

export const SessionExpired: Story = { args: { stato: "sessionExpired" } };

export const LongText: Story = { args: { stato: "longText" } };

export const LongTextTesto200: Story = {
  args: { stato: "longText" },
  parameters: { text200: true },
};

export const SenzaSessione: Story = { args: { stato: "anonimo" } };
