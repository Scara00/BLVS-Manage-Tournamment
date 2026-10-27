import { ActionLink } from "./action-link";
import { ErrorBoard } from "./error-board";
import { ScoreboardRows } from "./scoreboard-rows";

export type Role = "giocatore" | "admin";

const roleLabels: Record<Role, string> = {
  giocatore: "Giocatore",
  admin: "Admin",
};

/** 403: the user's role against the one the page requires. */
export function ForbiddenContent({
  currentRole = "giocatore",
  requiredRole = "admin",
  documentTitle,
}: {
  currentRole?: Role;
  requiredRole?: Role;
  documentTitle?: string;
}) {
  return (
    <ErrorBoard
      code={403}
      title="Accesso negato"
      documentTitle={documentTitle}
      board={
        <ScoreboardRows
          label="Ruoli"
          rows={[
            { label: "Il tuo ruolo", value: roleLabels[currentRole] },
            {
              label: "Richiesto",
              value: roleLabels[requiredRole],
              tone: "tape",
            },
          ]}
        />
      }
      actions={
        <>
          <ActionLink href="/" variant="primary">
            Torna alla home
          </ActionLink>
          <ActionLink href="/tappe">Vai alle tappe</ActionLink>
        </>
      }
    >
      <p>
        Questa sezione è riservata al ruolo {roleLabels[requiredRole]}. Se pensi
        di averne diritto, chiedi a un amministratore del circuito di aggiornare
        il tuo ruolo, poi accedi di nuovo.
      </p>
    </ErrorBoard>
  );
}
