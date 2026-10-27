import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { useEffect, useRef } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { PageContainer } from "@/components/layout/page-container";
import { composizioneDemo } from "@/lib/gironi/editor/fixtures";
import { applicaOperazione } from "@/lib/gironi/editor/operazioni";
import {
  GIRONI_EDITOR_MESSAGES as M,
  NON_ASSEGNATI,
  type ComposizioneGironi,
  type Destinazione,
  type ModificaGironiAction,
} from "@/lib/gironi/editor/types";
import { GironiEditor } from "./gironi-editor";
import { GironiEditorLoading } from "./gironi-editor-loading";

const signOut = async () => ({ error: null });

/** Saves after a short pause, like the demo store. */
const salvaFinto: ModificaGironiAction = async ({ versione, operazione }) => {
  await new Promise((resolve) => setTimeout(resolve, 300));
  const esito = applicaOperazione(
    { ...composizioneDemo(), versione },
    operazione,
  );
  return esito.ok
    ? {
        status: "ok",
        composizione: { ...esito.composizione, versione: versione + 1 },
      }
    : { status: "error", message: M.notFound };
};

/** Never settles: the editor stays in its «saving» state. */
const inAttesaPerSempre: ModificaGironiAction = () => new Promise(() => {});

function conGironeIncompleto(): ComposizioneGironi {
  const c = composizioneDemo();
  const [primo, ...resto] = c.gironi[0].giocatori;
  c.gironi[0].giocatori = resto;
  c.nonAssegnati = [primo];
  return c;
}

function conDoppione(): ComposizioneGironi {
  const c = composizioneDemo();
  c.gironi[1].giocatori = [...c.gironi[1].giocatori, c.gironi[0].giocatori[0]];
  return c;
}

type SchermataProps = {
  composizione: ComposizioneGironi;
  caricamento?: boolean;
  modifica?: ModificaGironiAction;
  offline?: boolean;
  erroreIniziale?: string;
  spostaAperto?: { iscrizioneId: string; verso?: Destinazione };
  /** Clicks «Aggiungi girone» on mount (with `inAttesaPerSempre`: saving). */
  aggiungiSubito?: boolean;
};

/** w-admin-gironi (and w-admin-sposta) inside the admin shell. */
function Schermata({
  composizione,
  caricamento = false,
  modifica = salvaFinto,
  offline,
  erroreIniziale,
  spostaAperto,
  aggiungiSubito = false,
}: SchermataProps) {
  const contenuto = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!aggiungiSubito) return;
    const bottone = [
      ...(contenuto.current?.querySelectorAll("button") ?? []),
    ].find((b) => b.textContent?.includes("Aggiungi girone"));
    bottone?.click();
  }, [aggiungiSubito]);

  return (
    <div className="flex min-h-screen flex-col">
      <AppShell variant="admin" signOut={signOut}>
        <PageContainer
          title="Gironi"
          eyebrow="Amministrazione · Tappe"
          description="Sposta e scambia i giocatori, aggiungi o elimina gironi. Vale per i gironi Gold e Silver."
        >
          <div ref={contenuto}>
            {caricamento ? (
              <GironiEditorLoading />
            ) : (
              <GironiEditor
                editor={{
                  tappa: { id: "jesolo", nome: "Tappa 1 · Jesolo" },
                  categoria: "M",
                  composizione,
                }}
                modifica={modifica}
                offline={offline}
                erroreIniziale={erroreIniziale}
                spostaAperto={spostaAperto}
              />
            )}
          </div>
        </PageContainer>
      </AppShell>
    </div>
  );
}

const meta = {
  title: "Admin/Editor dei gironi",
  component: Schermata,
  args: { composizione: composizioneDemo() },
  parameters: {
    layout: "fullscreen",
    nextjs: {
      appDirectory: true,
      navigation: { pathname: "/admin/tappe/jesolo/gironi/m" },
    },
  },
} satisfies Meta<typeof Schermata>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Four full Gold groups: every check passes. */
export const Valido: Story = {};

export const Silver: Story = {
  args: { composizione: composizioneDemo({ fase: "silver" }) },
};

/** No Gold/Silver set yet on the board: no marks on the groups. */
export const SenzaFase: Story = {
  args: { composizione: composizioneDemo({ fase: null }) },
};

export const GironeIncompleto: Story = {
  args: { composizione: conGironeIncompleto() },
};

export const Doppione: Story = {
  args: { composizione: conDoppione() },
};

/** 18 players: two wait outside the groups. */
export const NonAssegnati: Story = {
  args: { composizione: composizioneDemo({ giocatori: 18 }) },
};

/** Confirmed players, no groups yet. */
export const SenzaGironi: Story = {
  args: { composizione: composizioneDemo({ giocatori: 8, gironi: 0 }) },
};

/** A group match has started: read-only. */
export const Bloccata: Story = {
  args: { composizione: composizioneDemo({ bloccata: true }) },
};

export const Salvataggio: Story = {
  args: { modifica: inAttesaPerSempre, aggiungiSubito: true },
};

export const Errore: Story = {
  args: { erroreIniziale: M.failed },
};

export const Conflitto: Story = {
  args: { erroreIniziale: M.conflict },
};

export const Offline: Story = {
  args: { offline: true, erroreIniziale: M.offline },
};

export const Caricamento: Story = {
  args: { caricamento: true },
};

export const NomiLunghi: Story = {
  args: { composizione: composizioneDemo({ giocatori: 24 }) },
};

export const Testo200: Story = {
  args: { composizione: conGironeIncompleto() },
  parameters: { text200: true },
};

/* ---- w-admin-sposta: «Sposta nel girone…» ---- */

/** Open on the first destination (a full group: swap proposed). */
export const SpostaDestinazione: Story = {
  name: "Sposta · scegli il girone",
  args: { spostaAperto: { iscrizioneId: "i1" } },
};

/** Into a group with a free seat: no swap by default. */
export const SpostaGironeLibero: Story = {
  name: "Sposta · girone con posto libero",
  args: {
    composizione: conGironeIncompleto(),
    spostaAperto: { iscrizioneId: "i5", verso: "g1" },
  },
};

export const SpostaVersoNonAssegnati: Story = {
  name: "Sposta · tra i non assegnati",
  args: { spostaAperto: { iscrizioneId: "i1", verso: NON_ASSEGNATI } },
};

export const SpostaDaNonAssegnati: Story = {
  name: "Sposta · da non assegnati",
  args: {
    composizione: composizioneDemo({ giocatori: 17 }),
    spostaAperto: { iscrizioneId: "i17" },
  },
};

/** One group only, the player in it: «Non assegnati» is the only choice. */
export const SpostaUnSoloGirone: Story = {
  name: "Sposta · un solo girone",
  args: {
    composizione: composizioneDemo({ giocatori: 4 }),
    spostaAperto: { iscrizioneId: "i1" },
  },
};

export const SpostaTesto200: Story = {
  name: "Sposta · testo al 200%",
  args: { spostaAperto: { iscrizioneId: "i1" } },
  parameters: { text200: true },
};
