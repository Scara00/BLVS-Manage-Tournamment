import { NotFoundContent } from "@/components/error-page";

/**
 * 404 inside the admin shell (see `[...resto]`). Only the root not-found
 * gets route metadata, so the board renders the `<title>`.
 */
export default function AdminNotFound() {
  return (
    <NotFoundContent
      stagesHref="/admin/tappe"
      homeHref="/admin"
      documentTitle="Pagina non trovata"
    />
  );
}
