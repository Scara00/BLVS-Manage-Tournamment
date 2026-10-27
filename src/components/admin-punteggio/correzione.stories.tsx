import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { AppShell } from "@/components/layout/app-shell";
import { PageContainer } from "@/components/layout/page-container";
import { Toaster, ToastProvider } from "@/components/ui/toast";
import {
  PUNTEGGIO_MESSAGES,
  type PunteggioState,
  type SalvaPunteggioAction,
} from "@/lib/punteggi/state";
import type { Lato } from "@/lib/punteggi/validazione";
import { InserimentoPunteggio, type Passo } from "./inserimento-punteggio";
import {
  annullaFinto,
  correzione,
  salvaConImpatto,
  salvaInCorso,
  salvaSenzaRete,
} from "./stories-data";

const signOut = async () => ({ error: null });

const AZIONI: Record<string, SalvaPunteggioAction> = {
  impatto: salvaConImpatto,
  inCorso: salvaInCorso,
  senzaRete: salvaSenzaRete,
};

type SchermataProps = {
  valori?: Record<Lato, string>;
  passo?: Passo;
  azione?: keyof typeof AZIONI;
  initialState?: PunteggioState;
};

/**
 * w-admin-correzione: a saved group score being corrected. «Conferma e
 * salva» on the default story opens w-admin-impatto-fase (the board's
 * next phase is already generated).
 */
function Schermata({
  valori,
  passo,
  azione = "impatto",
  initialState,
}: SchermataProps) {
  return (
    <ToastProvider>
      <div className="flex min-h-screen flex-col">
        <AppShell variant="admin" signOut={signOut}>
          <PageContainer
            title="Inserimento punteggio"
            eyebrow="Amministrazione · Punteggi"
            description="Un set a 21: inserisci i punti delle due coppie, controlla il riepilogo e salva."
          >
            <InserimentoPunteggio
              scheda={correzione}
              salva={AZIONI[azione]}
              annulla={annullaFinto}
              initialValori={valori}
              initialPasso={passo}
              verificaIniziale
              initialState={initialState}
            />
          </PageContainer>
        </AppShell>
      </div>
      <Toaster />
    </ToastProvider>
  );
}

const meta = {
  title: "Admin/Punteggio/Correzione",
  component: Schermata,
  parameters: {
    layout: "fullscreen",
    nextjs: {
      appDirectory: true,
      navigation: { pathname: "/admin/tappe/jesolo/punteggi/jesolo-M-g1-t1" },
    },
  },
} satisfies Meta<typeof Schermata>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The saved value, struck through, next to the new one: nothing changes yet. */
export const Iniziale: Story = {};

/** The winner flips: «Cosa cambia» lists the standing that follows. */
export const VincitoreRibaltato: Story = {
  args: { valori: { a: "10", b: "21" } },
};

/** fieldErrors: 21–20 «non chiude il set», written and announced. */
export const NonChiudeIlSet: Story = {
  args: { valori: { a: "21", b: "20" } },
};

/** The summary before saving: old and new, and what changes. */
export const Riepilogo: Story = {
  args: { valori: { a: "10", b: "21" }, passo: "riepilogo" },
};

/** loading: «Conferma e salva» busy. */
export const Salvataggio: Story = {
  args: { valori: { a: "10", b: "21" }, passo: "riepilogo", azione: "inCorso" },
};

/** network: the request failed; the typed values stay. */
export const SenzaRete: Story = {
  args: {
    valori: { a: "10", b: "21" },
    azione: "senzaRete",
    initialState: {
      status: "error",
      reason: "network",
      message: PUNTEGGIO_MESSAGES.network,
      at: 1,
    },
  },
};

export const Testo200: Story = {
  args: { valori: { a: "10", b: "21" } },
  parameters: { text200: true },
};
