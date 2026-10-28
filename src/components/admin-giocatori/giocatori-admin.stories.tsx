import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { withText200 } from "@/design-system/text-200";
import type { FiltriGiocatori } from "@/lib/giocatori/admin/filtri";
import { elenco } from "./fixtures";
import { GiocatoriAdmin } from "./giocatori-admin";
import { GiocatoriLoading, GiocatoriSessioneScaduta } from "./giocatori-stati";

const FILTRI: Record<string, FiltriGiocatori> = {
  completo: { q: "", daVerificare: false, pagina: 1 },
  daVerificare: { q: "", daVerificare: true, pagina: 1 },
  vuoto: { q: "zzz", daVerificare: false, pagina: 1 },
  pagine: { q: "", daVerificare: false, pagina: 2 },
};

/** w-admin-giocatori, without data fetching. */
function Screen({
  stato,
}: {
  stato: keyof typeof FILTRI | "loading" | "sessioneScaduta";
}) {
  if (stato === "loading") {
    return <GiocatoriLoading testo="Caricamento dei giocatori…" />;
  }
  if (stato === "sessioneScaduta") {
    return <GiocatoriSessioneScaduta from="/admin/giocatori" />;
  }
  return (
    <GiocatoriAdmin
      elenco={elenco(stato as Parameters<typeof elenco>[0])}
      filtri={FILTRI[stato]}
    />
  );
}

const meta = {
  title: "Admin/w-admin-giocatori",
  component: Screen,
  parameters: { nextjs: { appDirectory: true } },
  args: { stato: "completo" },
  argTypes: {
    stato: {
      control: "select",
      options: [...Object.keys(FILTRI), "loading", "sessioneScaduta"],
    },
  },
} satisfies Meta<typeof Screen>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Elenco: Story = {};
/** Filter «Solo categoria da verificare»: tape badges. */
export const DaVerificare: Story = { args: { stato: "daVerificare" } };
export const NessunRisultato: Story = { args: { stato: "vuoto" } };
export const Pagine: Story = { args: { stato: "pagine" } };
export const Caricamento: Story = { args: { stato: "loading" } };
export const SessioneScaduta: Story = { args: { stato: "sessioneScaduta" } };
export const Testo200: Story = { decorators: [withText200] };
