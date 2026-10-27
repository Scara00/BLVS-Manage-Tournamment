import { ArrowLeftIcon, MailXIcon } from "lucide-react";
import type { ReactNode } from "react";
import { PageContainer } from "@/components/layout/page-container";
import { Tape } from "@/components/scoreboard";
import { buttonVariants } from "@/components/ui/button";
import {
  PRIVACY_CONTROLLER,
  PRIVACY_POLICY_VERSION,
  formatPolicyDate,
  privacySections,
  type PrivacySectionId,
} from "@/lib/legal/privacy-policy";
import { cn } from "@/lib/utils";
import { PrivacyIndex } from "./privacy-index";
import { PrivacySampleRow } from "./privacy-sample-row";
import { ReturnLink } from "./return-link";

/*
 * Copy of the «Informativa privacy». TODO(cliente): replace with the text
 * approved by the client, keep the section ids in `privacySections` and bump
 * PRIVACY_POLICY_VERSION (src/lib/legal/privacy-policy.ts) on every change.
 */

const sectionTitle = Object.fromEntries(
  privacySections.map((s) => [s.id, s.title]),
) as Record<PrivacySectionId, string>;

function PolicySection({
  id,
  children,
}: {
  id: PrivacySectionId;
  children: ReactNode;
}) {
  return (
    <section
      id={id}
      tabIndex={-1}
      aria-labelledby={`${id}-titolo`}
      className="flex scroll-mt-space-4 flex-col gap-space-3 focus:outline-none"
    >
      <h2
        id={`${id}-titolo`}
        className="font-heading text-2xl font-semibold tracking-tight text-balance"
      >
        {sectionTitle[id]}
      </h2>
      {children}
    </section>
  );
}

/**
 * «Versione 1.0, in vigore dal …». The `data-*` attributes expose the version
 * as data for e2e and BLVS-12.
 */
function VersionLine() {
  const { number, date } = PRIVACY_POLICY_VERSION;
  return (
    <span
      data-testid="privacy-version"
      data-version={number}
      data-version-date={date}
    >
      Versione <span className="font-mono">{number}</span>, in vigore dal{" "}
      <time dateTime={date}>{formatPolicyDate(date)}</time>
    </span>
  );
}

/** Content of the «Informativa privacy» page (screen w-privacy). */
export function PrivacyPolicy({
  reducedMotion,
}: {
  /** Overrides `prefers-reduced-motion` for the sample row (stories, tests). */
  reducedMotion?: boolean;
}) {
  const { name, address, email } = PRIVACY_CONTROLLER;

  return (
    <PageContainer
      title="Informativa privacy"
      eyebrow="BLVS"
      description={<VersionLine />}
    >
      <section
        aria-labelledby="in-breve-titolo"
        className="flex flex-col gap-space-4 border-2 border-primary p-space-3 sm:p-inset md:p-inset-lg"
      >
        <Tape size={8} />
        <h2
          id="in-breve-titolo"
          className="font-heading text-2xl font-semibold tracking-tight"
        >
          In breve
        </h2>
        <ul className="flex max-w-prose list-disc flex-col gap-space-2 pl-space-5">
          <li>
            Usiamo nome, cognome, email e categoria per iscriverti alle tappe e
            gestire il circuito.
          </li>
          <li>
            In classifica e nelle pagine live compaiono solo la coppia, la
            posizione e i punti, come nella riga qui sotto.
          </li>
          <li>
            Se cancelli l&apos;account i tuoi dati personali vengono eliminati;
            i risultati restano, ma in forma anonima.
          </li>
        </ul>
        <div className="max-w-xl">
          <PrivacySampleRow reducedMotion={reducedMotion} />
        </div>
        <p className="flex items-start gap-space-3 bg-tape p-space-4 font-heading text-lg font-semibold text-primary">
          <MailXIcon aria-hidden className="mt-0.5 size-6 shrink-0" />
          L&apos;email non compare mai: né in classifica, né nelle pagine live,
          né in nessun&apos;altra pagina pubblica.
        </p>
      </section>

      <div className="grid gap-stack-lg lg:grid-cols-[min(16rem,33%)_minmax(0,1fr)] lg:items-start">
        <PrivacyIndex
          sections={privacySections}
          className="w-full max-w-64 lg:sticky lg:top-space-5"
        />

        <div className="flex max-w-prose min-w-0 flex-col gap-stack-lg">
          <PolicySection id="titolare">
            <p>
              Il titolare del trattamento è <strong>{name}</strong>, con sede in{" "}
              {address}.
            </p>
            <p>
              Per qualsiasi domanda sui tuoi dati scrivi a{" "}
              <a
                href={`mailto:${email}`}
                className="font-semibold underline decoration-2 underline-offset-4 focus-ring hover:decoration-4"
              >
                {email}
              </a>
              . Rispondiamo entro 30 giorni.
            </p>
          </PolicySection>

          <PolicySection id="dati-raccolti">
            <ul className="flex list-disc flex-col gap-space-2 pl-space-5">
              <li>
                <strong>Dati di registrazione</strong>: nome, cognome, email,
                categoria di gioco.
              </li>
              <li>
                <strong>Dati di gara</strong>: iscrizioni alle tappe, compagno o
                compagna di coppia, risultati, punti e posizioni.
              </li>
              <li>
                <strong>Dati tecnici</strong>: i cookie strettamente necessari a
                mantenere la sessione di accesso. Non usiamo cookie di
                profilazione.
              </li>
            </ul>
          </PolicySection>

          <PolicySection id="finalita-base-giuridica">
            <ul className="flex list-disc flex-col gap-space-2 pl-space-5">
              <li>
                <strong>Gestire account, iscrizioni e tappe</strong>: è
                necessario per eseguire il servizio che hai richiesto (art. 6,
                par. 1, lett. b del GDPR).
              </li>
              <li>
                <strong>Pubblicare classifiche e risultati</strong>: legittimo
                interesse del titolare a rendere pubblico l&apos;andamento delle
                competizioni (art. 6, par. 1, lett. f). Puoi opporti in
                qualsiasi momento.
              </li>
              <li>
                <strong>Inviarti comunicazioni di servizio</strong> (conferme,
                variazioni di orario): esecuzione del servizio (art. 6, par. 1,
                lett. b).
              </li>
              <li>
                <strong>Adempiere a obblighi di legge</strong>, ad esempio
                fiscali o sportivi (art. 6, par. 1, lett. c).
              </li>
            </ul>
          </PolicySection>

          <PolicySection id="cosa-e-pubblico">
            <p>
              Nelle classifiche e nelle pagine live chiunque può vedere, per
              ogni coppia:
            </p>
            <ul className="flex list-disc flex-col gap-space-2 pl-space-5">
              <li>nome e cognome dei due giocatori;</li>
              <li>categoria, tappa e fase del torneo;</li>
              <li>posizione, punti e punteggi delle partite.</li>
            </ul>
            <p>
              Non compaiono mai email, data di nascita né altri dati di
              contatto.
            </p>
          </PolicySection>

          <PolicySection id="conservazione-cancellazione">
            <p>
              Conserviamo i dati dell&apos;account finché resta attivo. Puoi
              chiederne la cancellazione in qualsiasi momento: entro 30 giorni
              eliminiamo nome, email e gli altri dati personali.
            </p>
            <p>
              Dopo la cancellazione i risultati restano nelle classifiche, ma in
              forma anonima (ad esempio «Giocatore anonimo»), così punteggi e
              posizioni degli altri giocatori restano corretti.
            </p>
            <p>
              I dati richiesti da obblighi di legge sono conservati solo per il
              tempo previsto dalla norma.
            </p>
          </PolicySection>

          <PolicySection id="diritti">
            <p>
              Puoi chiedere in qualsiasi momento di accedere ai tuoi dati,
              correggerli, cancellarli, limitarne il trattamento, riceverli in
              un formato portabile o opporti al trattamento (artt. 15–22 del
              GDPR), scrivendo all&apos;indirizzo indicato sopra.
            </p>
            <p>
              Se ritieni che i tuoi dati siano trattati in modo non corretto
              puoi presentare reclamo al Garante per la protezione dei dati
              personali.
            </p>
          </PolicySection>

          <PolicySection id="modifiche">
            <p>
              Se l&apos;informativa cambia in modo rilevante te lo segnaliamo al
              prossimo accesso e ti chiediamo di leggerla di nuovo. Stai
              leggendo la versione{" "}
              <span className="font-mono">{PRIVACY_POLICY_VERSION.number}</span>{" "}
              del{" "}
              <time dateTime={PRIVACY_POLICY_VERSION.date}>
                {formatPolicyDate(PRIVACY_POLICY_VERSION.date)}
              </time>
              .
            </p>
          </PolicySection>

          <ReturnLink
            className={cn(buttonVariants({ variant: "primary" }), "self-start")}
          >
            <ArrowLeftIcon aria-hidden />
            Torna alla pagina precedente
          </ReturnLink>
        </div>
      </div>
    </PageContainer>
  );
}
