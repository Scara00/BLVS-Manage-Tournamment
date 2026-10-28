import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import type { ReactNode } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { MinimalShell } from "@/components/layout/minimal-shell";
import { PageContainer } from "@/components/layout/page-container";
import { ProfiloSessioneScaduta } from "@/components/profilo";
import {
  PASSWORD_UPDATED_MESSAGE,
  SAME_PASSWORD_MESSAGE,
} from "@/lib/auth/password-reset/messages";
import {
  IMPOSTAZIONI_MESSAGES,
  type CambioPasswordAction,
  type CancellazioneAction,
} from "@/lib/impostazioni/types";
import { AccountCancellato } from "./account-cancellato";
import { EliminaAccount } from "./elimina-account";
import { impostazioniLuca, impostazioniTestoLungo, rigaLuca } from "./fixtures";
import { ImpostazioniView } from "./impostazioni-view";

const signOut = async () => ({ error: null });

/** Saves after a short pause, like the real action. */
const cambiaFinto: CambioPasswordAction = async () => {
  await new Promise((resolve) => setTimeout(resolve, 600));
  return { status: "success", message: PASSWORD_UPDATED_MESSAGE };
};

/** Never settles: the delete dialog stays in «Cancellazione…». */
const cancellaFinto: CancellazioneAction = () => new Promise(() => {});

function Giocatore({
  title,
  eyebrow,
  description,
  children,
}: {
  title: string;
  eyebrow: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col">
      <AppShell variant="player" signOut={signOut}>
        <PageContainer
          title={title}
          eyebrow={eyebrow}
          description={description}
        >
          {children}
        </PageContainer>
      </AppShell>
    </div>
  );
}

const meta = {
  title: "Impostazioni/Schermate",
  parameters: {
    layout: "fullscreen",
    nextjs: { appDirectory: true, navigation: { pathname: "/impostazioni" } },
  },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

const elimina = {
  nextjs: {
    appDirectory: true,
    navigation: { pathname: "/impostazioni/elimina-account" },
  },
};

function Impostazioni(props: Partial<Parameters<typeof ImpostazioniView>[0]>) {
  return (
    <Giocatore
      title="Impostazioni"
      eyebrow="Account"
      description="Password, consenso privacy e cancellazione dell'account."
    >
      <ImpostazioniView
        impostazioni={impostazioniLuca}
        cambiaPassword={cambiaFinto}
        {...props}
      />
    </Giocatore>
  );
}

/** w-impostazioni: password, consent with the public row, deletion. */
export const ImpostazioniDefault: Story = {
  name: "w-impostazioni",
  render: () => <Impostazioni />,
};

/** Errors next to each password field. */
export const ImpostazioniErrori: Story = {
  name: "w-impostazioni · errori",
  render: () => (
    <Impostazioni
      statoPassword={{
        status: "error",
        message: IMPOSTAZIONI_MESSAGES.invalid,
        fields: {
          attuale: IMPOSTAZIONI_MESSAGES.attualeErrata,
          password: SAME_PASSWORD_MESSAGE,
          conferma: "Le due password non coincidono.",
        },
      }}
    />
  ),
};

/** Not in the overall standing yet, and no consent row found. */
export const ImpostazioniSenzaClassifica: Story = {
  name: "w-impostazioni · non in classifica",
  render: () => (
    <Impostazioni
      impostazioni={{ ...impostazioniLuca, riga: null, consenso: null }}
    />
  ),
};

export const ImpostazioniTestoLungo: Story = {
  name: "w-impostazioni · testo lungo",
  render: () => <Impostazioni impostazioni={impostazioniTestoLungo} />,
};

/** 200% text at 390px: the public row becomes a card. */
export const ImpostazioniTesto200: Story = {
  name: "w-impostazioni · testo 200%",
  parameters: { text200: true },
  render: () => <Impostazioni impostazioni={impostazioniTestoLungo} />,
};

export const ImpostazioniSessioneScaduta: Story = {
  name: "w-impostazioni · sessione scaduta",
  render: () => (
    <Giocatore
      title="Impostazioni"
      eyebrow="Account"
      description="Password, consenso privacy e cancellazione dell'account."
    >
      <ProfiloSessioneScaduta from="/impostazioni" />
    </Giocatore>
  ),
};

function Elimina(props: Partial<Parameters<typeof EliminaAccount>[0]>) {
  return (
    <Giocatore
      title="Cancella l'account"
      eyebrow="Impostazioni"
      description="Prima di confermare, guarda cosa cambia nella classifica."
    >
      <EliminaAccount riga={rigaLuca} action={cancellaFinto} {...props} />
    </Giocatore>
  );
}

/** w-elimina-account: before and after, then ELIMINA. */
export const EliminaAccountDefault: Story = {
  parameters: elimina,
  name: "w-elimina-account",
  render: () => <Elimina />,
};

export const EliminaAccountErrore: Story = {
  parameters: elimina,
  name: "w-elimina-account · errore",
  render: () => (
    <Elimina
      initialState={{
        status: "error",
        message: IMPOSTAZIONI_MESSAGES.invalid,
        fields: { conferma: IMPOSTAZIONI_MESSAGES.confermaErrata },
      }}
    />
  ),
};

/** The last confirmation, in a dialog. */
export const EliminaAccountConferma: Story = {
  parameters: elimina,
  name: "w-elimina-account · conferma",
  render: () => <Elimina dialogoAperto />,
};

export const EliminaAccountTestoLungo: Story = {
  parameters: elimina,
  name: "w-elimina-account · testo lungo",
  render: () => <Elimina riga={impostazioniTestoLungo.riga} />,
};

export const EliminaAccountTesto200: Story = {
  parameters: { ...elimina, text200: true },
  name: "w-elimina-account · testo 200%",
  render: () => <Elimina riga={impostazioniTestoLungo.riga} />,
};

export const EliminaAccountSenzaClassifica: Story = {
  parameters: elimina,
  name: "w-elimina-account · non in classifica",
  render: () => <Elimina riga={null} />,
};

/** w-account-eliminato: public, after the deletion. */
export const AccountEliminato: Story = {
  parameters: {
    nextjs: {
      appDirectory: true,
      navigation: { pathname: "/account-cancellato" },
    },
  },
  name: "w-account-eliminato",
  render: () => (
    <div className="flex min-h-screen flex-col">
      <MinimalShell back={false}>
        <AccountCancellato />
      </MinimalShell>
    </div>
  ),
};
