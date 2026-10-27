import { ArrowLeftIcon } from "lucide-react";
import type { ReactNode } from "react";
import { ReturnLink } from "@/components/privacy/return-link";
import { cn } from "@/lib/utils";
import { MAIN_CONTENT_ID, SkipLink } from "./skip-link";

/**
 * Frame for standalone reading pages (Informativa privacy): skip link, a
 * black bar whose only control is a light «Indietro» link, and the `main`
 * landmark. No navigation and no «Esci»: the reader came here from a form
 * or a footer and should only go back.
 * `back={false}` drops «Indietro» too (Accesso, Sessione scaduta): going
 * back from there would only land on a page that needs the login again.
 */
export function MinimalShell({
  back = true,
  children,
}: {
  back?: boolean;
  children: ReactNode;
}) {
  return (
    <>
      <SkipLink />
      <header className="bg-primary text-primary-foreground">
        <div className="mx-auto flex min-h-(--spacing-space-8) w-full max-w-screen-2xl flex-wrap items-center gap-x-space-5 gap-y-space-2 px-inset py-space-2 md:px-inset-lg">
          {back ? (
            <ReturnLink
              className={cn(
                "inline-flex min-h-11 items-center gap-space-2 font-sans underline-offset-4 hover:underline",
                "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-foreground",
              )}
            >
              <ArrowLeftIcon aria-hidden className="size-5 shrink-0" />
              Indietro
            </ReturnLink>
          ) : null}
          <p
            className={cn(
              "font-heading text-2xl font-bold tracking-tight",
              back && "ml-auto",
            )}
          >
            BLVS
          </p>
        </div>
      </header>
      <main
        id={MAIN_CONTENT_ID}
        tabIndex={-1}
        className="flex min-w-0 flex-1 flex-col focus:outline-none"
      >
        {children}
      </main>
    </>
  );
}
