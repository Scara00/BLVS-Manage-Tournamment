import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { LiveLoading } from "@/components/live/live-loading";
import {
  ME_FIXTURE,
  stageFixture,
  syncFixture,
  type ScenarioTabellone,
} from "./fixtures";
import { TabelloneSessioneScaduta } from "./sessione-scaduta";
import { TabelloneLive } from "./tabellone";

type Stato =
  | ScenarioTabellone
  | "loading"
  | "spettatore"
  | "senzaGirone"
  | "ritirato"
  | "annullata"
  | "offline"
  | "reducedMotion"
  | "sessionExpired";

function TabelloneScreen({ stato }: { stato: Stato }) {
  if (stato === "loading") return <LiveLoading what="dei gironi" />;
  if (stato === "sessionExpired")
    return <TabelloneSessioneScaduta tappaId="t" />;
  const scenario: ScenarioTabellone =
    stato === "iscrizioni" ||
    stato === "gironi_iniziali" ||
    stato === "gironi_gold_silver" ||
    stato === "finali" ||
    stato === "conclusa"
      ? stato
      : stato === "senzaGirone" || stato === "annullata"
        ? "iscrizioni"
        : "gironi_iniziali";
  const stage = stageFixture(scenario, {
    note:
      stato === "ritirato"
        ? new Map([
            ["m4", "Ritirato"],
            ["m7", "Assente in 1 partita"],
          ])
        : undefined,
    statoTappa: stato === "annullata" ? "annullata" : undefined,
  });
  return (
    <TabelloneLive
      tappaId="t"
      initial={syncFixture(stage)}
      me={stato === "spettatore" ? null : ME_FIXTURE}
      connect={false}
      initialStatus={stato === "offline" ? "offline" : "live"}
      reducedMotion={stato === "reducedMotion" ? true : undefined}
    />
  );
}

const meta = {
  title: "Tappe/Gironi e fasi",
  component: TabelloneScreen,
  args: { stato: "gironi_iniziali" },
  argTypes: {
    stato: {
      control: "select",
      options: [
        "loading",
        "iscrizioni",
        "gironi_iniziali",
        "gironi_gold_silver",
        "finali",
        "conclusa",
        "spettatore",
        "senzaGirone",
        "ritirato",
        "annullata",
        "offline",
        "reducedMotion",
        "sessionExpired",
      ],
    },
  },
  parameters: { layout: "padded" },
} satisfies Meta<typeof TabelloneScreen>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Loading: Story = { args: { stato: "loading" } };
/** Before the first phase: «Iscrizioni» is the current step. */
export const Iscrizioni: Story = { args: { stato: "iscrizioni" } };
export const GironiIniziali: Story = { args: { stato: "gironi_iniziali" } };
/** The initial groups move under the current ones, collapsed. */
export const GironiGoldSilver: Story = {
  args: { stato: "gironi_gold_silver" },
};
export const Finali: Story = { args: { stato: "finali" } };
/** BLVS-43: the board is closed, the step reads «Conclusa». */
export const Conclusa: Story = { args: { stato: "conclusa" } };
/** Not registered: no place, every group still visible. */
export const Spettatore: Story = { args: { stato: "spettatore" } };
export const SenzaGirone: Story = { args: { stato: "senzaGirone" } };
/** BLVS-42 notes as text in the standing. */
export const Ritirato: Story = { args: { stato: "ritirato" } };
export const Annullata: Story = { args: { stato: "annullata" } };
export const Offline: Story = { args: { stato: "offline" } };
/** No tape snap, no row flash or reorder animation. */
export const ReducedMotion: Story = { args: { stato: "reducedMotion" } };
export const SessionExpired: Story = { args: { stato: "sessionExpired" } };
