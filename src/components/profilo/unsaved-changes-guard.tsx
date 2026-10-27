"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type UnsavedChangesDialogProps = {
  open: boolean;
  /** «Resta»: closes the dialog (also on Esc). */
  onStay: () => void;
  /** «Esci senza salvare». */
  onLeave: () => void;
};

/** «Uscire senza salvare?»: initial focus on the safe action, «Resta». */
export function UnsavedChangesDialog({
  open,
  onStay,
  onLeave,
}: UnsavedChangesDialogProps) {
  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onStay();
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Uscire senza salvare?</AlertDialogTitle>
          <AlertDialogDescription>
            Hai modificato dei dati senza salvarli. Se esci ora, le modifiche
            andranno perse.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Resta sulla pagina</AlertDialogCancel>
          <AlertDialogAction tone="destructive" onClick={onLeave}>
            Esci senza salvare
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

/**
 * The internal link a click would follow, or `null` when the click is not
 * a plain same-tab navigation to another page of this site.
 */
export function navigationTarget(event: MouseEvent): string | null {
  if (
    event.defaultPrevented ||
    event.button !== 0 ||
    event.metaKey ||
    event.ctrlKey ||
    event.shiftKey ||
    event.altKey
  ) {
    return null;
  }
  const anchor =
    event.target instanceof Element ? event.target.closest("a[href]") : null;
  if (!(anchor instanceof HTMLAnchorElement)) return null;
  if ((anchor.target && anchor.target !== "_self") || anchor.download) {
    return null;
  }
  const url = new URL(anchor.href, window.location.href);
  // Other sites are covered by `beforeunload`; same-page anchors
  // (e.g. the skip link) do not leave the form.
  if (url.origin !== window.location.origin) return null;
  if (
    url.pathname === window.location.pathname &&
    url.search === window.location.search
  ) {
    return null;
  }
  return `${url.pathname}${url.search}${url.hash}`;
}

/**
 * While `when` is true, asks before leaving the page: an in-app link click
 * (topbar, nav, «Torna al profilo») opens `UnsavedChangesDialog`; a reload,
 * a closed tab or an external link gets the browser's own prompt.
 */
export function UnsavedChangesGuard({ when }: { when: boolean }) {
  const router = useRouter();
  const [pendingHref, setPendingHref] = useState<string | null>(null);

  useEffect(() => {
    if (!when) return;

    function onBeforeUnload(event: BeforeUnloadEvent) {
      event.preventDefault();
      // Older browsers need returnValue set to show the prompt.
      event.returnValue = "";
    }
    // Capture on document runs before React's handlers on the root, so
    // next/link never starts the navigation.
    function onClick(event: MouseEvent) {
      const href = navigationTarget(event);
      if (!href) return;
      event.preventDefault();
      event.stopPropagation();
      setPendingHref(href);
    }

    window.addEventListener("beforeunload", onBeforeUnload);
    document.addEventListener("click", onClick, true);
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      document.removeEventListener("click", onClick, true);
    };
  }, [when]);

  return (
    <UnsavedChangesDialog
      open={pendingHref !== null}
      onStay={() => setPendingHref(null)}
      onLeave={() => {
        const href = pendingHref;
        setPendingHref(null);
        if (href) router.push(href);
      }}
    />
  );
}
