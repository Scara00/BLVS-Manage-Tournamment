import { ListChecksIcon } from "lucide-react";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import type { StatoTappa } from "@/lib/db/types";
import { punteggiPath } from "@/lib/punteggi/paths";

/** From the stage page to w-admin-live, once the stage is in progress. */
export function PunteggiLink({
  tappaId,
  stato,
}: {
  tappaId: string;
  stato: StatoTappa;
}) {
  if (stato !== "in_corso") return null;
  return (
    <Link
      href={punteggiPath(tappaId)}
      className={buttonVariants({
        variant: "primary",
        className: "max-w-full self-start",
      })}
    >
      <ListChecksIcon aria-hidden className="size-4" />
      Inserisci i punteggi
    </Link>
  );
}
