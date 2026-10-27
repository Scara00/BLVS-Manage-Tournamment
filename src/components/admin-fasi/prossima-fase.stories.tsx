import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { AppShell } from "@/components/layout/app-shell";
import { PageContainer } from "@/components/layout/page-container";
import type {
  ProssimaFaseState,
  ProssimaFaseView,
} from "@/lib/gironi/fasi/types";
import { ProssimaFase } from "./prossima-fase";
import {
  azioneFinta,
  finaliGenerate,
  finaliPronte,
  propostaIncompleta,
  propostaNomiLunghi,
  propostaParita,
  propostaPronta,
  propostaSalvata,
} from "./stories-data";

const signOut = async () => ({ error: null });

type SchermataProps = {
  view: ProssimaFaseView;
  defaultOpen?: boolean;
  offline?: boolean;
  initialState?: ProssimaFaseState;
};

/** The panel as w-admin-gironi / w-admin-avvio-fase show it. */
function Schermata({
  view,
  defaultOpen,
  offline,
  initialState,
}: SchermataProps) {
  return (
    <div className="flex min-h-screen flex-col">
      <AppShell variant="admin" signOut={signOut}>
        <PageContainer
          title={view.tipo === "gold_silver" ? "Gironi" : "Avvio fase"}
          eyebrow="Amministrazione · Tappe"
        >
          <ProssimaFase
            view={view}
            action={azioneFinta}
            defaultOpen={defaultOpen}
            offline={offline}
            initialState={initialState}
          />
        </PageContainer>
      </AppShell>
    </div>
  );
}

const meta = {
  title: "Admin/Gironi gold e silver e finali",
  component: Schermata,
  args: { view: propostaPronta },
  parameters: {
    layout: "fullscreen",
    nextjs: {
      appDirectory: true,
      navigation: { pathname: "/admin/tappe/jesolo/gironi/m" },
    },
  },
} satisfies Meta<typeof Schermata>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Initial groups concluded: gold = 1st and 2nd, silver = 3rd and 4th. */
export const PropostaGoldSilver: Story = {};

/** The confirmation before saving the proposal. */
export const PropostaConferma: Story = { args: { defaultOpen: true } };

/** A tie to resolve blocks the proposal, with «Risolvi parità». */
export const PropostaBloccataDaParita: Story = {
  args: { view: propostaParita },
};

/** Three initial groups: two groups of 2 to complete in the editor. */
export const PropostaIncompleta: Story = { args: { view: propostaIncompleta } };

/** Saved: the editor below shows the groups to check before the start. */
export const PropostaSalvata: Story = { args: { view: propostaSalvata } };

/** Gold and silver concluded: the gold final and the silver final. */
export const Finali: Story = {
  args: { view: finaliPronte },
  parameters: {
    nextjs: {
      appDirectory: true,
      navigation: { pathname: "/admin/tappe/jesolo/avvio/m" },
    },
  },
};

export const FinaliConferma: Story = {
  args: { view: finaliPronte, defaultOpen: true },
};

/** The finals exist: the board is at «Finali». */
export const FinaliGenerate: Story = { args: { view: finaliGenerate } };

/** The server refused: the message is announced. */
export const Errore: Story = {
  args: {
    initialState: {
      status: "error",
      reason: "blocked",
      message:
        "C'è una parità da risolvere: la proposta parte dopo la risoluzione.",
      at: 1,
    },
  },
};

export const Offline: Story = { args: { offline: true } };

export const Testo200: Story = {
  args: { view: propostaNomiLunghi },
  parameters: { text200: true },
};
