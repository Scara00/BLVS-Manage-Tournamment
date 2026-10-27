"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { listDrafts, type Draft } from "@/lib/drafts/drafts";
import {
  describeReturnPath,
  loginHref,
  safeAfterLoginPath,
} from "@/lib/navigation/auth-paths";
import { RETURN_PARAM } from "@/lib/navigation/safe-return-path";
import { SessionExpiredView } from "./session-expired-view";

function SessionExpiredFromParams() {
  const params = useSearchParams();
  const returnPath = safeAfterLoginPath(params?.get(RETURN_PARAM));
  const [drafts, setDrafts] = useState<Draft[] | null>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- localStorage is an external store
    setDrafts(listDrafts());
  }, []);

  return (
    <SessionExpiredView
      destination={describeReturnPath(returnPath)}
      returnPath={returnPath}
      loginHref={loginHref(returnPath, { reason: "scaduta" })}
      drafts={drafts}
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
