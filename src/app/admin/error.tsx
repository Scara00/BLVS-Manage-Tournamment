"use client";

import { RouteError } from "@/components/error-page/route-error";

/** Failed render inside the admin shell (status stays 500, see the player one). */
export default function AdminError(props: {
  error: unknown;
  retry: () => void;
}) {
  return <RouteError {...props} formHref="/admin/tappe" homeHref="/admin" />;
}
