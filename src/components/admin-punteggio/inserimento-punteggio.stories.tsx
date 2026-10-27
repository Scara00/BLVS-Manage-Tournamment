import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { GestioneTappaLoading } from "@/components/admin-tappa";
import { AppShell } from "@/components/layout/app-shell";
import { PageContainer } from "@/components/layout/page-container";
import { Toaster, ToastProvider } from "@/components/ui/toast";
import type { PunteggioState } from "@/lib/punteggi/state";
import type { SchedaPunteggio } from "@/lib/punteggi/types";
import type { Lato } from "@/lib/punteggi/validazione";
import { InserimentoPunteggio, type Passo } from "./inserimento-punteggio";
import {
  annullaFinto,
  daInserire,
  giaSalvata,
  nomiLunghi,
  nonGiocabile,
  salvaFinto,
  salvaInCorso,
} from "./stories-data";

const signOut = async () => ({ error: null });

type SchermataProps = {
  scheda: SchedaPunteggio;
  caricamento?: boolean;
  valori?: Record<Lato, string>;
  passo?: Passo;
  verifica?: boolean;
  offline?: boolean;
  inCorso?: boolean;
  initialState?: PunteggioState;
};

/** w-admin-punteggio / w-admin-punteggio-riepilogo inside the admin shell. */
function Schermata({
  scheda,
  caricamento,
  valori,
  passo,
  verifica,
  offline,
  inCorso,
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
            {caricamento ? (
              <GestioneTappaLoading testo="Caricamento della partita…" />
            ) : (
              <InserimentoPunteggio
                scheda={scheda}
                salva={inCorso ? salvaInCorso : salvaFinto}
                annulla={annullaFinto}
                initialValori={valori}
                initialPasso={passo}
                verificaIniziale={verifica}
                offline={offline}
                initialState={initialState}
              />
            )}
          </PageContainer>
        </AppShell>
      </div>
      <Toaster />
    </ToastProvider>
  );
}

const meta = {
  title: "Admin/Punteggio",
  component: Schermata,
  args: { scheda: daInserire },
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

/** Empty fields: every outcome «· da inserire». */
export const Vuoto: Story = {};

/** A valid score: ✓ on both fields. */
export const Valido: Story = {
  args: { valori: { a: "21", b: "19" }, verifica: true },
};

/** Ties are refused, on both fields. */
export const Pareggio: Story = {
  args: { valori: { a: "21", b: "21" }, verifica: true },
};

/** 21–20: the set rule asks for two points of margin. */
export const RegolaDelSet: Story = {
  args: { valori: { a: "21", b: "20" }, verifica: true },
};

/** Not a whole number, and a field left empty at «Vai al riepilogo». */
export const ValoriNonValidi: Story = {
  args: { valori: { a: "1.5", b: "" }, verifica: true },
};

/** The server refused the score (same rule as the form). */
export const ErroreServer: Story = {
  args: {
    valori: { a: "23", b: "20" },
    initialState: {
      status: "fieldErrors",
      campi: {},
      punteggio:
        "Oltre i 21 il set finisce con esattamente 2 punti di scarto (per esempio 23–21).",
      message: "Il punteggio non è valido: correggi i campi indicati.",
      at: 1,
    },
  },
};

/** w-admin-punteggio-riepilogo before saving. */
export const Riepilogo: Story = {
  args: { valori: { a: "19", b: "21" }, passo: "riepilogo" },
};

/** Saving: «Conferma e salva» busy. */
export const Salvataggio: Story = {
  args: { valori: { a: "19", b: "21" }, passo: "riepilogo", inCorso: true },
};

/** Correction of a saved score: the summary says what it replaces. */
export const Correzione: Story = {
  args: {
    scheda: giaSalvata,
    valori: { a: "23", b: "21" },
    passo: "riepilogo",
  },
};

/** Saved: the confirmation message; the toast offers «Annulla» for 10 s. */
export const Salvato: Story = {
  args: {
    scheda: giaSalvata,
    initialState: {
      status: "success",
      partitaId: giaSalvata.partita.id,
      versione: 2,
      punteggio: { a: 21, b: 17 },
      tipo: "inserimento",
      message: "Punteggio salvato",
      at: 1,
    },
  },
};

/** Someone else saved meanwhile: reload before saving again. */
export const Conflitto: Story = {
  args: {
    valori: { a: "21", b: "19" },
    initialState: {
      status: "error",
      reason: "conflict",
      message:
        "Il punteggio di questa partita è cambiato nel frattempo: ricarica la pagina per vedere quello attuale.",
      at: 1,
    },
  },
};

/** No network: «Conferma e salva» blocked, with the reason. */
export const Offline: Story = {
  args: { valori: { a: "19", b: "21" }, passo: "riepilogo", offline: true },
};

/** The stage is no longer in progress. */
export const NonGiocabile: Story = { args: { scheda: nonGiocabile } };

/** The page while the match is read (Suspense fallback). */
export const Loading: Story = { args: { caricamento: true } };

export const Testo200: Story = {
  args: { scheda: nomiLunghi, valori: { a: "21", b: "20" }, verifica: true },
  parameters: { text200: true },
};

export const Testo200Riepilogo: Story = {
  args: {
    scheda: nomiLunghi,
    valori: { a: "22", b: "24" },
    passo: "riepilogo",
  },
  parameters: { text200: true },
};
