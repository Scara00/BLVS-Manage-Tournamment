import { UsersIcon } from "lucide-react";
import Link from "next/link";
import { StatoTappaBadge } from "@/components/admin-tappa/stato-badge";
import {
  ResponsiveTable,
  type ResponsiveTableColumn,
} from "@/components/responsive-table/responsive-table";
import { buttonVariants } from "@/components/ui/button";
import { iscrittiPath } from "@/lib/iscrizioni/admin/paths";
import type { TappaAdminItem } from "@/lib/tappe/gestione-format";

const columns: ResponsiveTableColumn<TappaAdminItem>[] = [
  { key: "nome", header: "Tappa", rowHeader: true },
  { key: "periodo", header: "Date", width: "22%" },
  {
    key: "stato",
    header: "Stato",
    width: "22%",
    render: (row) => (
      <span className="flex [overflow-wrap:anywhere]">
        <StatoTappaBadge stato={row.stato} />
      </span>
    ),
  },
  {
    key: "azioni",
    header: "Azioni",
    width: "24%",
    render: (row) => (
      <Link
        href={iscrittiPath(row.id)}
        aria-label={`Iscritti di ${row.nome}`}
        className={buttonVariants({
          variant: "secondary",
          className: "max-w-full",
        })}
      >
        <UsersIcon aria-hidden className="size-4" />
        Iscritti
      </Link>
    ),
  },
];

/** /admin/iscrizioni: pick the stage whose registrants to manage. */
export function SceltaTappaIscritti({
  tappe,
}: {
  tappe: readonly TappaAdminItem[];
}) {
  return (
    <ResponsiveTable
      caption="Scegli la tappa"
      columns={columns}
      rows={tappe}
      getRowKey={(row) => row.id}
      emptyMessage="Non ci sono ancora tappe."
    />
  );
}
