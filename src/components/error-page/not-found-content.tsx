import { ActionLink } from "./action-link";
import { ErrorBoard } from "./error-board";

/** 404: the ball is out, back to the stages. */
export function NotFoundContent({
  stagesHref = "/tappe",
  homeHref = "/",
  documentTitle,
}: {
  /** Where «Rientra dalle tappe» leads: `/admin/tappe` in the admin area. */
  stagesHref?: string;
  homeHref?: string;
  documentTitle?: string;
}) {
  return (
    <ErrorBoard
      code={404}
      title="Pagina non trovata"
      documentTitle={documentTitle}
      board={
        <p
          data-slot="error-banner"
          className="flex flex-wrap gap-0.5 font-mono text-lg font-bold tracking-wider uppercase"
        >
          <span className="grow bg-primary px-space-4 py-space-3 text-primary-foreground">
            Fuori campo
          </span>
          <span className="sr-only"> · </span>
          <span className="grow-[2] bg-tape px-space-4 py-space-3 text-primary">
            Rientra dalle tappe
          </span>
        </p>
      }
      actions={
        <>
          <ActionLink href={stagesHref} variant="primary">
            Vai alle tappe
          </ActionLink>
          <ActionLink href={homeHref}>Torna alla home</ActionLink>
        </>
      }
    >
      <p>
        L&apos;indirizzo che hai aperto non esiste o è stato spostato. Riparti
        dall&apos;elenco delle tappe del circuito.
      </p>
    </ErrorBoard>
  );
}
