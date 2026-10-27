import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { useEffect, useRef } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { PageContainer } from "@/components/layout/page-container";
import { ToastProvider, Toaster } from "@/components/ui/toast";
import {
  TAPPA_MODIFICA_MESSAGES as M,
  maxSottoIscrittiMessage,
  type TappaModifica,
  type TappaModificaAction,
  type TappaModificaFormState,
} from "@/lib/tappe/modifica/types";
import {
  TappaModificaSessioneScaduta,
  TappaNonModificabile,
} from "./tappa-modifica-avvisi";
import { TappaModificaForm } from "./tappa-modifica-form";
import { TappaModificaLoading } from "./tappa-modifica-loading";

const signOut = async () => ({ error: null });

const rimini: TappaModifica = {
  id: "rimini",
  nome: "Tappa 2 · Rimini",
  luogo: "Rimini, Bagno 26",
  data: "2027-06-28",
  dataFine: "2027-06-29",
  scadenza: "2027-06-24T20:00",
  stato: "iscrizioni_aperte",
  versione: 3,
  tabelloni: {
    M: { posti: 16, iscritti: 12 },
    F: { posti: 16, iscritti: 9 },
  },
};

const testoLungo: TappaModifica = {
  ...rimini,
  nome: "Tappa straordinaria di fine stagione · Lido di Spina e Porto Garibaldi",
  luogo:
    "Lido degli Estensi, Bagno Pineta Mare, accesso dal lungomare Italia angolo via dei Mille",
};

/** Saves after a short pause, like the real action. */
const salvaFinto: TappaModificaAction = async (_prev, formData) => {
  await new Promise((resolve) => setTimeout(resolve, 600));
  return {
    status: "success",
    message: M.saved,
    tappa: {
      ...rimini,
      nome: String(formData.get("nome") ?? ""),
      luogo: String(formData.get("luogo") ?? ""),
      versione: rimini.versione + 1,
      tabelloni: {
        M: { ...rimini.tabelloni.M, posti: Number(formData.get("postiM")) },
        F: { ...rimini.tabelloni.F, posti: Number(formData.get("postiF")) },
      },
    },
  };
};

/** Never settles: the form stays in its «saving» state. */
const inAttesaPerSempre: TappaModificaAction = () => new Promise(() => {});

type SchermataProps = {
  tappa: TappaModifica;
  stato?: "pronto" | "caricamento" | "sessioneScaduta" | "nonModificabile";
  initialState?: TappaModificaFormState;
  action?: TappaModificaAction;
  /** Submits the form on mount (with `inAttesaPerSempre`: loading). */
  inviaSubito?: boolean;
};

/** w-admin-tappa-modifica inside the admin shell. */
function Schermata({
  tappa,
  stato = "pronto",
  initialState,
  action = salvaFinto,
  inviaSubito = false,
}: SchermataProps) {
  const contenuto = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (inviaSubito) contenuto.current?.querySelector("form")?.requestSubmit();
  }, [inviaSubito]);

  return (
    <ToastProvider>
      <div className="flex min-h-screen flex-col">
        <AppShell variant="admin" signOut={signOut}>
          <PageContainer
            title="Modifica tappa"
            eyebrow="Amministrazione · Tappe"
            description="Aggiorna nome, luogo, date, scadenza e massimo di iscritti per tabellone. Il massimo non può scendere sotto gli iscritti attuali."
          >
            <div ref={contenuto}>
              {stato === "caricamento" ? <TappaModificaLoading /> : null}
              {stato === "sessioneScaduta" ? (
                <TappaModificaSessioneScaduta
                  from={`/admin/tappe/${tappa.id}/modifica`}
                />
              ) : null}
              {stato === "nonModificabile" ? (
                <TappaNonModificabile nome={tappa.nome} stato="in_corso" />
              ) : null}
              {stato === "pronto" ? (
                <TappaModificaForm
                  tappa={tappa}
                  action={action}
                  initialState={initialState}
                />
              ) : null}
            </div>
          </PageContainer>
        </AppShell>
      </div>
      <Toaster />
    </ToastProvider>
  );
}

const meta = {
  title: "Admin/Modifica tappa",
  component: Schermata,
  args: { tappa: rimini },
  argTypes: {
    stato: {
      control: "inline-radio",
      options: ["pronto", "caricamento", "sessioneScaduta", "nonModificabile"],
    },
  },
  parameters: {
    layout: "fullscreen",
    nextjs: {
      appDirectory: true,
      navigation: { pathname: "/admin/tappe/rimini/modifica" },
    },
  },
} satisfies Meta<typeof Schermata>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

/** Maximums that leave incomplete groups: the warning panel shows up. */
export const GironiIncompleti: Story = {
  args: {
    tappa: {
      ...rimini,
      tabelloni: {
        M: { posti: 18, iscritti: 12 },
        F: { posti: 10, iscritti: 9 },
      },
    },
  },
};

export const ErroriCampi: Story = {
  args: {
    initialState: {
      status: "error",
      message: M.invalid,
      fields: {
        nome: "Campo obbligatorio.",
        scadenza: M.scadenzaDopoTappa,
        postiM: maxSottoIscrittiMessage(12),
      },
    },
  },
};

export const InvioInCorso: Story = {
  args: { action: inAttesaPerSempre, inviaSubito: true },
};

export const Caricamento: Story = { args: { stato: "caricamento" } };

export const Offline: Story = {
  args: { initialState: { status: "offline", message: M.offline } },
};

export const PermessoNegato: Story = {
  args: {
    initialState: { status: "permissionDenied", message: M.permissionDenied },
  },
};

export const SessioneScaduta: Story = {
  args: {
    initialState: { status: "sessionExpired", message: M.sessionExpired },
  },
};

export const SessioneScadutaAllaLettura: Story = {
  args: { stato: "sessioneScaduta" },
};

export const ConflittoDiVersione: Story = {
  args: {
    initialState: {
      status: "conflict",
      message: M.conflict,
      tappa: {
        ...rimini,
        nome: "Tappa 2 · Rimini (spostata)",
        data: "2027-07-05",
        dataFine: "2027-07-06",
        versione: 4,
        tabelloni: {
          M: { posti: 20, iscritti: 13 },
          F: { posti: 16, iscritti: 9 },
        },
      },
    },
  },
};

export const NonModificabile: Story = { args: { stato: "nonModificabile" } };

export const TestoLungo: Story = { args: { tappa: testoLungo } };

export const Testo200: Story = {
  args: { tappa: testoLungo },
  parameters: { text200: true },
};
