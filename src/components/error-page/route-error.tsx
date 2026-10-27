"use client";

import { useEffect, useState } from "react";
import { errorCode } from "@/lib/errors/error-code";
import { now } from "@/lib/time/server-time";
import { ServiceUnavailable } from "./service-unavailable";

/** Body of the `error.tsx` boundaries: the 503 page for a failed render. */
export function RouteError({
  error,
  retry,
  formHref,
  homeHref,
}: {
  error: unknown;
  retry: () => void;
  formHref?: string;
  homeHref?: string;
}) {
  const [at] = useState(now);

  useEffect(() => {
    console.error("[errore] rendering fallito", error);
  }, [error]);

  return (
    <ServiceUnavailable
      what="Il caricamento di questa pagina"
      code={errorCode(error)}
      at={at}
      onRetry={retry}
      formHref={formHref}
      homeHref={homeHref}
      documentTitle="Servizio non disponibile"
    />
  );
}
