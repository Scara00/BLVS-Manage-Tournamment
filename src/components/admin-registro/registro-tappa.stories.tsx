import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { AppShell } from "@/components/layout/app-shell";
import { PageContainer } from "@/components/layout/page-container";
import type {
  CaricaPrecedentiAction,
  RegistroTappaView,
} from "@/lib/registro/types";
import { RegistroTappa } from "./registro-tappa";
import { RegistroLoading } from "./registro-stati";
import { paginaPrecedente, registroStorie } from "./stories-data";

const signOut = async () => ({ error: null });

const caricaFinta: CaricaPrecedentiAction = async () => ({
  status: "ok",
  pagina: paginaPrecedente(6),
});

type SchermataProps = {
  registro: RegistroTappaView;
  caricamento?: boolean;
  online?: boolean;
};

/** w-admin-registro inside the admin shell. */
function Schermata({ registro, caricamento, online = true }: SchermataProps) {
  return (
    <div className="flex min-h-screen flex-col">
      <AppShell variant="admin" signOut={signOut}>
        <PageContainer
          title="Registro dei punteggi"
          eyebrow="Amministrazione · Tappe"
          description="Ogni inserimento, correzione e annullamento dei punteggi, con ritiri, parità risolte, rigenerazioni e cambi di categoria: chi, quando, prima e dopo. Le voci non si modificano."
        >
          {caricamento ? (
            <RegistroLoading />
          ) : (
            <RegistroTappa
              registro={registro}
              caricaPrecedenti={caricaFinta}
              online={online}
              tappaHref="/admin/tappe/jesolo"
            />
          )}
        </PageContainer>
      </AppShell>
    </div>
  );
}

const meta = {
  title: "Admin/Registro dei punteggi",
  component: Schermata,
  args: { registro: registroStorie() },
  parameters: {
    layout: "fullscreen",
    nextjs: {
      appDirectory: true,
      navigation: { pathname: "/admin/tappe/jesolo/registro" },
    },
  },
} satisfies Meta<typeof Schermata>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Three days of entries: badges only on Correzione and Parità risolta. */
export const Registro: Story = {};

/** More entries than one page: «Mostra le 6 voci precedenti». */
export const ConVociPrecedenti: Story = {
  args: { registro: registroStorie({ restanti: 6 }) },
};

export const Caricamento: Story = { args: { caricamento: true } };

export const Vuoto: Story = { args: { registro: registroStorie({ voci: 0 }) } };

export const VuotoPerIFiltri: Story = {
  args: {
    registro: registroStorie({
      voci: 0,
      filtri: { tipo: "parita_risolta", partita: null },
    }),
  },
};

/** Offline: the entries read so far stay, loading more waits for the network. */
export const Offline: Story = {
  args: { registro: registroStorie({ restanti: 6 }), online: false },
};

export const Testo200: Story = { parameters: { text200: true } };
