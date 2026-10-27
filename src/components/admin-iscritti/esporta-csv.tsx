"use client";

import { DownloadIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { csvFilename, iscrittiCsv } from "@/lib/iscrizioni/admin/csv";
import type { IscrittiTappaView } from "@/lib/iscrizioni/admin/types";

/**
 * «Esporta CSV»: the registrants the page shows, as a UTF-8 file (with BOM,
 * `;`) built in the browser, so it needs no extra request and holds
 * exactly what the admin sees.
 */
export function EsportaCsv({ tappa }: { tappa: IscrittiTappaView }) {
  return (
    <Button
      variant="secondary"
      className="max-w-full"
      onClick={() => {
        const blob = new Blob([iscrittiCsv(tappa)], {
          type: "text/csv;charset=utf-8",
        });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = csvFilename(tappa);
        document.body.append(link);
        link.click();
        link.remove();
        setTimeout(() => URL.revokeObjectURL(url), 0);
      }}
    >
      <DownloadIcon aria-hidden className="size-4" />
      Esporta CSV
    </Button>
  );
}
