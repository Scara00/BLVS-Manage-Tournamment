import { notFound } from "next/navigation";

/**
 * Any unknown /admin/* URL: answers HTTP 404 inside the admin shell instead
 * of falling through to the root not-found page.
 */
export default function AdminCatchAll() {
  notFound();
}
