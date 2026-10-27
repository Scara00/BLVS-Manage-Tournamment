import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { AppShell } from "@/components/layout/app-shell";
import { PageContainer } from "@/components/layout/page-container";
import type { ElencoPunteggi } from "@/lib/punteggi/types";
import { ElencoPunteggiView } from "./elenco-punteggi";
import { elenco } from "./stories-data";

const signOut = async () => ({ error: null });

/** w-admin-live inside the admin shell. */
function Schermata({ elenco }: { elenco: ElencoPunteggi }) {
  return (
    <div className="flex min-h-screen flex-col">
      <AppShell variant="admin" signOut={signOut}>
        <PageContainer
          title="Punteggi"
          eyebrow="Amministrazione · Tappe"
          description="Le partite dei gironi della tappa: inserisci o correggi il punteggio a bordo campo."
        >
          <ElencoPunteggiView elenco={elenco} />
        </PageContainer>
      </AppShell>
    </div>
  );
}

const meta = {
  title: "Admin/Punteggi della tappa",
  component: Schermata,
  args: { elenco },
  parameters: {
    layout: "fullscreen",
    nextjs: {
      appDirectory: true,
      navigation: { pathname: "/admin/tappe/jesolo/punteggi" },
    },
  },
} satisfies Meta<typeof Schermata>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Some matches saved, some still to enter. */
export const InCorso: Story = {};

/** No group matches yet: the phase hasn't started. */
export const Vuoto: Story = { args: { elenco: { ...elenco, partite: [] } } };

/** Stage over: results only, no entry links. */
export const Conclusa: Story = {
  args: {
    elenco: { ...elenco, tappa: { ...elenco.tappa, stato: "conclusa" } },
  },
};

export const Testo200: Story = { parameters: { text200: true } };
