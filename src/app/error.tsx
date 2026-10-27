"use client";

import { RouteError } from "@/components/error-page/route-error";
import { MAIN_CONTENT_ID } from "@/components/layout/skip-link";

/**
 * Last boundary under the root layout: it catches errors thrown by the
 * player/admin layouts themselves, so it does not re-render a shell.
 */
export default function RootError(props: {
  error: unknown;
  retry: () => void;
}) {
  return (
    <main id={MAIN_CONTENT_ID} tabIndex={-1} className="flex flex-1 flex-col">
      <RouteError {...props} />
    </main>
  );
}
