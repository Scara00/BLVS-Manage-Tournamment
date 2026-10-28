"use client";

import { NotaAssenza } from "@/components/live/nota-assenza";
import { giocatoriGirone } from "@/lib/ritiri/anteprima";
import { notaAssenze } from "@/lib/ritiri/format";
import { RitiroDialog, type RitiroDialogProps } from "./ritiro-dialog";

/**
 * Under a group of w-admin-live: the withdrawals and absences already
 * recorded, as text, and «Ritiro o assenza» (w-admin-ritiro).
 */
export function RitiroGirone(props: RitiroDialogProps) {
  const { partite, assenze, girone } = props;
  const ids = new Set(partite.map((p) => p.id));
  const delGirone = assenze.filter((a) => ids.has(a.partitaId));
  const registrati = giocatoriGirone(partite).flatMap((g) => {
    const nota = notaAssenze(
      delGirone.filter((a) => a.iscrizioneId === g.iscrizioneId),
    );
    return nota ? [{ ...g, nota }] : [];
  });
  return (
    <div
      className="flex flex-col gap-space-2"
      data-testid={`ritiro-girone-${girone.id}`}
    >
      {registrati.length > 0 ? (
        <ul
          aria-label={`Ritiri e assenze · ${girone.nome}`}
          className="flex flex-col gap-space-1"
        >
          {registrati.map((g) => (
            <li
              key={g.iscrizioneId}
              className="flex flex-wrap items-center gap-space-2 [overflow-wrap:anywhere]"
            >
              <span className="font-semibold">{g.nome}</span>
              <NotaAssenza nota={g.nota} />
            </li>
          ))}
        </ul>
      ) : null}
      <RitiroDialog {...props} />
    </div>
  );
}
