import { notFound } from "next/navigation";
import { isErrorPreviewEnabled } from "@/lib/errors/preview";
import { Guasto } from "./guasto";

/** Dev/e2e only: a page that fails once hydrated, to show the error boundary. */
export default function AnteprimaErrore() {
  if (!isErrorPreviewEnabled()) notFound();
  return <Guasto />;
}
