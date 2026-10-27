"use client";

import * as React from "react";
import {
  Toast as ToastPrimitive,
  type ToastManagerAddOptions,
} from "@base-ui/react/toast";
import { XIcon } from "lucide-react";
import { cn } from "cn";

/** Every toast stays up 6 s; hovering or focusing the viewport pauses it. */
const TOAST_TIMEOUT = 6000;
const TOAST_LIMIT = 3;

type ToastProviderProps = Omit<ToastPrimitive.Provider.Props, "timeout"> & {
  timeout?: number;
};

/**
 * Owns the toast queue. Mounted once in `src/components/providers.tsx`,
 * together with `<Toaster />`.
 */
function ToastProvider({
  timeout = TOAST_TIMEOUT,
  limit = TOAST_LIMIT,
  ...props
}: ToastProviderProps) {
  return <ToastPrimitive.Provider timeout={timeout} limit={limit} {...props} />;
}

type ToastOptions = ToastManagerAddOptions<object>;

/**
 * Shows notifications from any client component under `ToastProvider`:
 * `toast.add({ title, description, actionProps: { children: "Annulla", onClick } })`.
 */
function useToast() {
  const { add, close, update, promise } = ToastPrimitive.useToastManager();
  return React.useMemo(
    () => ({ add, close, update, promise }),
    [add, close, update, promise],
  );
}

function ToastItem({ toast }: { toast: ToastPrimitive.Root.ToastObject }) {
  return (
    <ToastPrimitive.Root
      toast={toast}
      data-slot="toast"
      className={cn(
        "pointer-events-auto flex w-full items-start gap-space-3 rounded-none bg-primary p-inset font-sans text-primary-foreground shadow-lg",
        "transition-[opacity,translate] duration-200 ease-out motion-reduce:transition-none",
        "translate-x-(--toast-swipe-movement-x) translate-y-(--toast-swipe-movement-y)",
        "data-ending-style:opacity-0 data-limited:hidden data-starting-style:translate-y-space-2 data-starting-style:opacity-0",
      )}
    >
      <ToastPrimitive.Content className="flex min-w-0 flex-1 flex-col gap-space-1 py-space-1 [overflow-wrap:anywhere]">
        <ToastPrimitive.Title
          data-slot="toast-title"
          className="text-base font-semibold"
        />
        <ToastPrimitive.Description
          data-slot="toast-description"
          className="text-sm"
        />
      </ToastPrimitive.Content>
      {/* Action and close are 48px targets (BLVS-32: «Annulla» courtside). */}
      {toast.actionProps && (
        <ToastPrimitive.Action
          data-slot="toast-action"
          className="inline-flex min-h-12 min-w-12 shrink-0 items-center justify-center rounded-none border-2 border-primary-foreground px-space-4 text-base font-semibold transition-colors outline-none hover:bg-primary-foreground hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-foreground motion-reduce:transition-none"
        />
      )}
      <ToastPrimitive.Close
        data-slot="toast-close"
        aria-label="Chiudi notifica"
        // Base UI hides it from AT while a stacked viewport is collapsed; our
        // list is never collapsed, and a focusable aria-hidden button fails axe.
        aria-hidden={false}
        className="inline-flex size-12 shrink-0 items-center justify-center rounded-none outline-none hover:bg-primary-foreground hover:text-primary focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary-foreground [&_svg]:size-4"
      >
        <XIcon aria-hidden />
      </ToastPrimitive.Close>
    </ToastPrimitive.Root>
  );
}

/**
 * The polite live region with the toast stack: full width at the bottom on
 * phones, bottom-right from `sm` up.
 */
function Toaster({ className, ...props }: ToastPrimitive.Viewport.Props) {
  const { toasts } = ToastPrimitive.useToastManager();

  return (
    <ToastPrimitive.Portal>
      <ToastPrimitive.Viewport
        data-slot="toaster"
        aria-label="Notifiche"
        className={cn(
          "pointer-events-none fixed inset-x-0 bottom-0 z-[60] flex flex-col-reverse gap-stack-sm p-space-4 outline-none sm:right-0 sm:left-auto sm:w-[26rem] sm:max-w-full",
          className,
        )}
        {...props}
      >
        {toasts.map((toast) => (
          <ToastItem key={toast.id} toast={toast} />
        ))}
      </ToastPrimitive.Viewport>
    </ToastPrimitive.Portal>
  );
}

export {
  TOAST_TIMEOUT,
  ToastProvider,
  Toaster,
  useToast,
  type ToastOptions,
  type ToastProviderProps,
};
