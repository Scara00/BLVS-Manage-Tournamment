"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { privacyHref } from "@/lib/navigation/safe-return-path";

/** Page footer (contentinfo): legal links that bring the reader back here. */
export function AppFooter() {
  const pathname = usePathname();
  return (
    <footer className="border-t border-border">
      <div className="mx-auto flex w-full max-w-screen-2xl flex-wrap items-center gap-x-space-5 gap-y-space-2 px-inset py-space-3 text-sm md:px-inset-lg">
        <Link
          href={privacyHref(pathname)}
          className="inline-flex min-h-11 items-center underline decoration-1 underline-offset-4 focus-ring hover:decoration-2"
        >
          Informativa privacy
        </Link>
      </div>
    </footer>
  );
}
