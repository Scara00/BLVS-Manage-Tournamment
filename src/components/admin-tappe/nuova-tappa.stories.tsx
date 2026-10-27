import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { useEffect, useRef } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { PageContainer } from "@/components/layout/page-container";
import { ToastProvider, Toaster } from "@/components/ui/toast";
import {
  NUOVA_TAPPA_MESSAGES as M,
  type NuovaTappaAction,
  type NuovaTappaFormState,
} from "@/lib/tappe/nuova/types";
import { NuovaTappaForm } from "./nuova-tappa-form";
import { NuovaTappaLoading } from "./nuova-tappa-loading";
import { NuovaTappaSessioneScaduta } from "./nuova-tappa-sessione-scaduta";

const signOut = async () => ({ error: null });

/** Saves after a short pause, like the real action. */
const creaFinta: NuovaTappaAction = async () => {
  await new Promise((resolve) => setTimeout(resolve, 600));
  return { status: "success", message: M.created, id: "t1", href: "/admin" };
};

/** Never settles: the form stays in its «saving» state. */
const inAttesaPerSempre: NuovaTappaAction = () => new Promise(() => {});

type SchermataProps = {
  stato?: "pronto" | "caricamento" | "sessioneScaduta";
  initialState?: NuovaTappaFormState;
  action?: NuovaTappaAction;
  posti?: { M: number; F: number };
  /** Submits the form on mount (with `inAttesaPerSempre`: loading). */
  inviaSubito?: boolean;
};

/** w-admin-tappa-nuova inside the admin shell. */
function Schermata({
  stato = "pronto",
  initialState,
  action = creaFinta,
  posti,
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
            title="Nuova tappa"
            eyebrow="Tappe"
            description="Crea una tappa in bozza: potrai aprire le iscrizioni in un secondo momento."
          >
            <div ref={contenuto}>
              {stato === "caricamento" ? <NuovaTappaLoading /> : null}
              {stato === "sessioneScaduta" ? (
                <NuovaTappaSessioneScaduta />
              ) : null}
              {stato === "pronto" ? (
                <NuovaTappaForm
                  action={action}
                  initialState={initialState}
                  posti={posti}
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
  title: "Admin/Nuova tappa",
  component: Schermata,
  argTypes: {
    stato: {
      control: "inline-radio",
      options: ["pronto", "caricamento", "sessioneScaduta"],
    },
  },
  parameters: {
    layout: "fullscreen",
    nextjs: {
      appDirectory: true,
      navigation: { pathname: "/admin/tappe/nuova" },
    },
  },
} satisfies Meta<typeof Schermata>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const ErroriCampi: Story = {
  args: {
    initialState: {
      status: "error",
      message: M.invalid,
      fields: {
        nome: "Campo obbligatorio.",
        data: M.dataPassata,
        scadenza: M.scadenzaDopoTappa,
        postiF: M.posti,
      },
    },
  },
};

export const AvvisoGironi: Story = {
  args: { posti: { M: 20, F: 32 } },
};

export const Salvataggio: Story = {
  args: { action: inAttesaPerSempre, inviaSubito: true },
};

export const Caricamento: Story = { args: { stato: "caricamento" } };

export const SessioneScaduta: Story = { args: { stato: "sessioneScaduta" } };

export const SessioneScadutaAlSalvataggio: Story = {
  args: {
    initialState: { status: "sessionExpired", message: M.sessionExpired },
  },
};

export const PermessoNegato: Story = {
  args: {
    initialState: { status: "permissionDenied", message: M.permissionDenied },
  },
};

export const Testo200: Story = {
  args: { posti: { M: 20, F: 12 } },
  parameters: { text200: true },
};
