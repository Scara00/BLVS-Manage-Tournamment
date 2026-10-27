import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { ForbiddenContent, ServiceUnavailable } from "@/components/error-page";
import { AppShell } from "@/components/layout/app-shell";
import { PageContainer } from "@/components/layout/page-container";
import { Toaster, ToastProvider } from "@/components/ui/toast";
import type { GestioneTappaView } from "@/lib/tappe/gestione-format";
import { GestioneTappa } from "./gestione-tappa";
import { GestioneTappaLoading } from "./gestione-tappa-loading";
import {
  ADESSO,
  aggiornaScadenzaFinto,
  aperte,
  bozza,
  bozzaSenzaScadenza,
  cambiaStatoFinto,
  chiuseAutomaticamente,
  testoLungo,
} from "./stories-data";

const signOut = async () => ({ error: null });

type SchermataProps = {
  tappa: GestioneTappaView;
  stato?: "pronto" | "caricamento" | "permessoNegato" | "erroreRete";
  offline?: boolean;
};

/** w-admin-tappa inside the admin shell. */
function Schermata({ tappa, stato = "pronto", offline }: SchermataProps) {
  return (
    <ToastProvider>
      <div className="flex min-h-screen flex-col">
        <AppShell variant="admin" signOut={signOut}>
          {stato === "permessoNegato" ? (
            <ForbiddenContent />
          ) : stato === "erroreRete" ? (
            <ServiceUnavailable
              what="La pagina della tappa"
              code="ERR-503-TAPPA"
              at={ADESSO}
              onRetry={() => {}}
              formHref="/admin/tappe"
              homeHref="/admin"
            />
          ) : (
            <PageContainer
              title="Gestione tappa"
              eyebrow="Amministrazione · Tappe"
              description="Apri e chiudi le iscrizioni, imposta la scadenza e controlla i tabelloni."
            >
              {stato === "caricamento" ? (
                <GestioneTappaLoading />
              ) : (
                <GestioneTappa
                  tappa={tappa}
                  cambiaStato={cambiaStatoFinto}
                  aggiornaScadenza={aggiornaScadenzaFinto}
                  offline={offline}
                />
              )}
            </PageContainer>
          )}
        </AppShell>
      </div>
      <Toaster />
    </ToastProvider>
  );
}

const meta = {
  title: "Admin/Gestione tappa",
  component: Schermata,
  args: { tappa: aperte },
  parameters: {
    layout: "fullscreen",
    nextjs: {
      appDirectory: true,
      navigation: { pathname: "/admin/tappe/rimini" },
    },
  },
} satisfies Meta<typeof Schermata>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Registrations open: days to the deadline and «Chiudi le iscrizioni». */
export const IscrizioniAperte: Story = {};

/** Draft, not visible to players yet: «Apri le iscrizioni». */
export const Bozza: Story = { args: { tappa: bozza } };

/** A draft cannot open without a deadline: the reason is written next to it. */
export const BozzaSenzaScadenza: Story = {
  args: { tappa: bozzaSenzaScadenza },
};

/** The deadline job closed them: the page says so in words. */
export const ChiuseAutomaticamente: Story = {
  args: { tappa: chiuseAutomaticamente },
};

export const Caricamento: Story = { args: { stato: "caricamento" } };

/** No network: buttons stay focusable but blocked, with the reason. */
export const Offline: Story = { args: { offline: true } };

export const PermessoNegato: Story = { args: { stato: "permessoNegato" } };

export const ErroreRete: Story = { args: { stato: "erroreRete" } };

export const TestoLungo: Story = { args: { tappa: testoLungo } };

export const Testo200: Story = {
  args: { tappa: testoLungo },
  parameters: { text200: true },
};
