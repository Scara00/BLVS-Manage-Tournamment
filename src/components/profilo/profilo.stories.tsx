import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { useEffect, useRef } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { PageContainer } from "@/components/layout/page-container";
import {
  PROFILO_MESSAGES,
  emailInAttesaMessage,
  type Profilo,
  type ProfiloAction,
  type ProfiloFormState,
} from "@/lib/profilo/types";
import {
  CANCELLA_ACCOUNT_MESSAGES,
  type CancellaAccountAction,
} from "@/lib/account/types";
import { ProfiloForm } from "./profilo-form";
import { ProfiloLoading } from "./profilo-loading";
import { ProfiloSessioneScaduta } from "./profilo-sessione-scaduta";
import { ProfiloView } from "./profilo-view";
import { UnsavedChangesDialog } from "./unsaved-changes-guard";

const signOut = async () => ({ error: null });

const marco: Profilo = {
  nome: "Marco",
  cognome: "Rossi",
  email: "marco.rossi@blvs.test",
  emailConfermata: true,
  emailInAttesa: null,
  categoria: "M",
  statoCategoria: "modificabile",
};

const testoLungo: Profilo = {
  nome: "Maria Antonietta Costanza Filomena",
  cognome: "Dell'Acqua Bianchi Lombardi di Sant'Elpidio a Mare",
  email:
    "maria.antonietta.costanza.filomena.dellacqua-bianchi@associazione-sportiva-dilettantistica-beach-volley.example.it",
  emailConfermata: true,
  emailInAttesa:
    "m.a.c.f.dellacqua.bianchi.lombardi.santelpidio@posta-certificata-molto-lunga.example.it",
  categoria: "F",
  statoCategoria: "bloccata",
};

/** Saves after a short pause, like the real action. */
const salvaFinto: ProfiloAction = async (_prev, formData) => {
  await new Promise((resolve) => setTimeout(resolve, 600));
  return {
    status: "success",
    message: PROFILO_MESSAGES.saved,
    values: {
      nome: String(formData.get("nome") ?? ""),
      cognome: String(formData.get("cognome") ?? ""),
      email: String(formData.get("email") ?? ""),
      categoria: formData.get("categoria") === "F" ? "F" : "M",
    },
    emailInAttesa: null,
  };
};

/** Answers with field errors, like a failed server validation. */
const rifiutaFinto: ProfiloAction = async () => ({
  status: "error",
  message: PROFILO_MESSAGES.invalid,
  fields: { nome: "Campo obbligatorio.", email: PROFILO_MESSAGES.emailTaken },
});

/** «Cancella l'account» answers like `cancella_account()` for an admin. */
const cancellaFinto: CancellaAccountAction = async () => ({
  status: "error",
  message: CANCELLA_ACCOUNT_MESSAGES.accountAdmin,
});

/** Never settles: the form stays in its «saving» state. */
const inAttesaPerSempre: ProfiloAction = () => new Promise(() => {});

type SchermataProps = {
  schermata: "profilo" | "modifica";
  profilo: Profilo;
  stato?: "pronto" | "caricamento" | "sessioneScaduta";
  initialState?: ProfiloFormState;
  action?: ProfiloAction;
  /** Submits the form on mount (with `inAttesaPerSempre`: loading). */
  inviaSubito?: boolean;
};

/** w-profilo / w-profilo-modifica inside the player shell, with the topbar. */
function Schermata({
  schermata,
  profilo,
  stato = "pronto",
  initialState,
  action = salvaFinto,
  inviaSubito = false,
}: SchermataProps) {
  const contenuto = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (inviaSubito) contenuto.current?.querySelector("form")?.requestSubmit();
  }, [inviaSubito]);

  const modifica = schermata === "modifica";
  return (
    <div className="flex min-h-screen flex-col">
      <AppShell variant="player" signOut={signOut}>
        <PageContainer
          title={modifica ? "Modifica profilo" : "Il tuo profilo"}
          eyebrow="Profilo"
          description={
            modifica
              ? "Aggiorna nome, cognome, email e, finché non hai giocato una tappa, la categoria."
              : "I tuoi dati personali e la categoria in cui giochi."
          }
        >
          <div ref={contenuto}>
            {stato === "caricamento" ? <ProfiloLoading /> : null}
            {stato === "sessioneScaduta" ? (
              <ProfiloSessioneScaduta
                from={modifica ? "/profilo/modifica" : "/profilo"}
              />
            ) : null}
            {stato === "pronto" && !modifica ? (
              <ProfiloView profilo={profilo} cancellaAccount={cancellaFinto} />
            ) : null}
            {stato === "pronto" && modifica ? (
              <ProfiloForm
                profilo={profilo}
                action={action}
                initialState={initialState}
              />
            ) : null}
          </div>
        </PageContainer>
      </AppShell>
    </div>
  );
}

const meta = {
  title: "Profilo/Schermate",
  component: Schermata,
  args: { schermata: "profilo", profilo: marco },
  argTypes: {
    schermata: { control: "inline-radio", options: ["profilo", "modifica"] },
    stato: {
      control: "inline-radio",
      options: ["pronto", "caricamento", "sessioneScaduta"],
    },
  },
  parameters: {
    layout: "fullscreen",
    nextjs: { appDirectory: true, navigation: { pathname: "/profilo" } },
  },
} satisfies Meta<typeof Schermata>;

export default meta;
type Story = StoryObj<typeof meta>;

const modifica = {
  nextjs: { appDirectory: true, navigation: { pathname: "/profilo/modifica" } },
};

// --- w-profilo -------------------------------------------------------------

export const ProfiloDefault: Story = {};

export const ProfiloCategoriaBloccata: Story = {
  args: { profilo: { ...marco, statoCategoria: "bloccata" } },
};

export const ProfiloEmailInAttesa: Story = {
  args: {
    profilo: {
      ...marco,
      emailInAttesa: "marco.rossi@nuovo.example.it",
    },
  },
};

export const ProfiloCaricamento: Story = { args: { stato: "caricamento" } };

export const ProfiloScaduto: Story = {
  args: { stato: "sessioneScaduta" },
};

export const ProfiloTestoLungo: Story = { args: { profilo: testoLungo } };

export const ProfiloTesto200: Story = {
  args: { profilo: testoLungo },
  parameters: { text200: true },
};

// --- w-profilo-modifica ----------------------------------------------------

export const Modifica: Story = {
  args: { schermata: "modifica" },
  parameters: modifica,
};

export const ModificaErroriCampi: Story = {
  args: {
    schermata: "modifica",
    initialState: {
      status: "error",
      message: PROFILO_MESSAGES.invalid,
      fields: {
        nome: "Campo obbligatorio.",
        email: PROFILO_MESSAGES.emailTaken,
        categoria: PROFILO_MESSAGES.categoria.iscrizione_attiva,
      },
    },
  },
  parameters: modifica,
};

/** Submitting gives server errors: focus moves to the first one. */
export const ModificaInvioConErrori: Story = {
  args: { schermata: "modifica", action: rifiutaFinto },
  parameters: modifica,
};

export const ModificaInvioInCorso: Story = {
  args: {
    schermata: "modifica",
    action: inAttesaPerSempre,
    inviaSubito: true,
  },
  parameters: modifica,
};

export const ModificaCaricamento: Story = {
  args: { schermata: "modifica", stato: "caricamento" },
  parameters: modifica,
};

export const ModificaSalvata: Story = {
  args: {
    schermata: "modifica",
    profilo: { ...marco, emailInAttesa: "marco.rossi@nuovo.example.it" },
    initialState: {
      status: "success",
      message: PROFILO_MESSAGES.saved,
      values: { ...marco, email: "marco.rossi@nuovo.example.it" },
      emailInAttesa: "marco.rossi@nuovo.example.it",
    },
  },
  parameters: modifica,
};

export const ModificaSessioneScaduta: Story = {
  args: {
    schermata: "modifica",
    initialState: {
      status: "sessionExpired",
      message: PROFILO_MESSAGES.sessionExpired,
    },
  },
  parameters: modifica,
};

export const ModificaCategoriaBloccata: Story = {
  args: {
    schermata: "modifica",
    profilo: { ...marco, statoCategoria: "bloccata" },
  },
  parameters: modifica,
};

export const ModificaTestoLungo: Story = {
  args: {
    schermata: "modifica",
    profilo: testoLungo,
    initialState: {
      status: "error",
      message: PROFILO_MESSAGES.invalid,
      fields: {
        email: `${PROFILO_MESSAGES.emailTaken} ${emailInAttesaMessage(testoLungo.emailInAttesa!, testoLungo.email)}`,
      },
    },
  },
  parameters: modifica,
};

export const ModificaTesto200: Story = {
  args: { schermata: "modifica", profilo: testoLungo },
  parameters: { ...modifica, text200: true },
};

/** The «Uscire senza salvare?» dialog, open so axe sees it. */
export const DialogModificheNonSalvate: StoryObj<typeof UnsavedChangesDialog> =
  {
    render: (args) => (
      <>
        <p>Modulo del profilo con modifiche non salvate.</p>
        <UnsavedChangesDialog {...args} />
      </>
    ),
    args: { open: true, onStay: () => {}, onLeave: () => {} },
    parameters: { layout: "centered" },
  };
