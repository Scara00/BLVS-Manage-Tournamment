"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { listDrafts, type Draft } from "@/lib/drafts/drafts";
import { storeDelDispositivo } from "@/lib/punteggi/coda/store";
import type { VoceCoda } from "@/lib/punteggi/coda/types";
import {
  describeReturnPath,
  loginHref,
  safeAfterLoginPath,
} from "@/lib/navigation/auth-paths";
import { RETURN_PARAM } from "@/lib/navigation/safe-return-path";
import {
  SessionExpiredView,
  sessionExpiredVariant,
} from "./session-expired-view";

function SessionExpiredFromParams() {
  const params = useSearchParams();
  const returnPath = safeAfterLoginPath(params?.get(RETURN_PARAM));
  const [drafts, setDrafts] = useState<Draft[] | null>(null);
  const [punteggi, setPunteggi] = useState<VoceCoda[] | null>(null);
  const variant = sessionExpiredVariant(returnPath);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- localStorage is an external store
    setDrafts(listDrafts());
  }, []);

  useEffect(() => {
    if (variant !== "admin") return;
    let attivo = true;
    // BLVS-33: the score queue lives in IndexedDB, it outlives the session.
    storeDelDispositivo()
      .leggi()
      .catch(() => [])
      .then((voci) => {
        if (attivo) setPunteggi(voci);
      });
    return () => {
      attivo = false;
    };
  }, [variant]);

  return (
    <SessionExpiredView
      destination={describeReturnPath(returnPath)}
      returnPath={returnPath}
      loginHref={loginHref(returnPath, { reason: "scaduta" })}
      drafts={drafts}
      variant={variant}
      punteggi={punteggi}
    />
  );
}

/** Expired-session page body, reading `?da=` and the local drafts. */
export function SessionExpired() {
  return (
    <Suspense
      fallback={
        <SessionExpiredView
          destination={describeReturnPath("/")}
          returnPath="/"
          loginHref={loginHref(null, { reason: "scaduta" })}
          drafts={null}
        />
      }
    >
      <SessionExpiredFromParams />
    </Suspense>
  );
}
