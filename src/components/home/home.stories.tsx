import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import {
  gara,
  garaFinita,
  garaParziale,
  garaVuota,
  home,
  prossimaAperta,
  prossimaChiusa,
  prossimaEsaurita,
  prossimaInAttesa,
  prossimaIscritto,
} from "./fixtures";
import { HomeGiocatore, HomeLoading } from "./home-giocatore";

type Stato =
  | "loading"
  | "sessionExpired"
  | "gara"
  | "garaParziale"
  | "garaOffline"
  | "garaFinita"
  | "garaSenzaPartite"
  | "garaRiduzioneMovimento"
  | "prossimaAperta"
  | "prossimaIscritto"
  | "prossimaInAttesa"
  | "prossimaEsaurita"
  | "prossimaChiusa"
  | "vuota";

const VISTE = {
  gara,
  garaParziale,
  garaOffline: gara,
  garaFinita,
  garaSenzaPartite: garaVuota,
  garaRiduzioneMovimento: garaParziale,
  prossimaAperta,
  prossimaIscritto,
  prossimaInAttesa,
  prossimaEsaurita,
  prossimaChiusa,
  vuota: { tipo: "vuota" as const },
};

/** w-home (BLVS-52) in every state, with no live connection. */
function HomeScreen({ stato }: { stato: Stato }) {
  if (stato === "loading") return <HomeLoading />;
  if (stato === "sessionExpired") {
    return <HomeGiocatore home={{ status: "sessionExpired" }} />;
  }
  return (
    <HomeGiocatore
      home={home(VISTE[stato])}
      gara={{
        connect: false,
        initialStatus: stato === "garaOffline" ? "offline" : "live",
        reducedMotion: stato === "garaRiduzioneMovimento" ? true : undefined,
      }}
    />
  );
}

const meta = {
  title: "Giocatore/w-home",
  component: HomeScreen,
  args: { stato: "gara" },
  argTypes: {
    stato: {
      control: "select",
      options: ["loading", "sessionExpired", ...Object.keys(VISTE)],
    },
  },
  parameters: { layout: "padded" },
} satisfies Meta<typeof HomeScreen>;

export default meta;
type Story = StoryObj<typeof meta>;

export const GiornoDiGara: Story = {};
export const GiornoDiGaraParziale: Story = { args: { stato: "garaParziale" } };
export const GiornoDiGaraOffline: Story = { args: { stato: "garaOffline" } };
export const GiornoDiGaraPartiteFinite: Story = {
  args: { stato: "garaFinita" },
};
export const GiornoDiGaraSenzaPartite: Story = {
  args: { stato: "garaSenzaPartite" },
};
export const GiornoDiGaraRiduzioneMovimento: Story = {
  args: { stato: "garaRiduzioneMovimento" },
};
export const ProssimaTappaAperta: Story = { args: { stato: "prossimaAperta" } };
export const ProssimaTappaIscritto: Story = {
  args: { stato: "prossimaIscritto" },
};
export const ProssimaTappaInAttesa: Story = {
  args: { stato: "prossimaInAttesa" },
};
export const ProssimaTappaEsaurita: Story = {
  args: { stato: "prossimaEsaurita" },
};
export const ProssimaTappaChiusa: Story = { args: { stato: "prossimaChiusa" } };
export const Vuota: Story = { args: { stato: "vuota" } };
export const Caricamento: Story = { args: { stato: "loading" } };
export const SessioneScaduta: Story = { args: { stato: "sessionExpired" } };
export const Testo200: Story = {
  args: { stato: "gara" },
  parameters: { text200: true },
};
