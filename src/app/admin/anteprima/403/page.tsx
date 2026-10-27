import { forbidden, notFound } from "next/navigation";
import { isErrorPreviewEnabled } from "@/lib/errors/preview";

/** Dev/e2e only: shows the 403 page with its real status code. */
export default function AnteprimaForbidden() {
  if (!isErrorPreviewEnabled()) notFound();
  forbidden();
}
