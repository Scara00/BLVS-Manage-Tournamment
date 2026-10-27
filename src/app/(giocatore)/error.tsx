"use client";

import { RouteError } from "@/components/error-page/route-error";

/**
 * Failed render inside the player shell. Error boundaries cannot set the
 * status code (it stays 500): this is the 503 page as content only.
 */
export default function PlayerError(props: {
  error: unknown;
  retry: () => void;
}) {
  return <RouteError {...props} />;
}
