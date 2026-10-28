"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { privacyHref } from "@/lib/navigation/safe-return-path";
import { cn } from "@/lib/utils";

/**
 * Page footer (contentinfo): legal links that bring the reader back here.
 * `fullBleed` follows the Topbar: full width beside a sidebar.
 */
export function AppFooter({ fullBleed = false }: { fullBleed?: boolean }) {
  const pathname = usePathname();
  return (
    <footer className="border-t border-border">
      <div
        className={cn(
          "mx-auto flex w-full flex-wrap items-center gap-x-space-5 gap-y-space-2 px-inset py-space-3 text-sm md:px-inset-lg",
          !fullBleed && "max-w-frame",
        )}
      >
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
