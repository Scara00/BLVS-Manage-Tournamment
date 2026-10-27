"use client";

import * as React from "react";
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { Loader2Icon, XIcon } from "lucide-react";
import { cn } from "cn";

import { Button } from "@/components/ui/button";

/**
 * Shared overlay styles for Dialog and AlertDialog (R-66).
 *
 * The popup is a flex column capped at the viewport height minus a
 * `space-4` margin on each side: header and footer never shrink, only the
 * body scrolls, so the actions stay visible at 390 px. Padding is `inset`
 * on phones and `inset-lg` from `sm` up. If header and footer alone exceed
 * the height (e.g. 200 % text on a phone) the whole popup scrolls instead
 * of clipping.
 */
const overlayClassName =
  "fixed inset-0 isolate z-50 bg-black/60 duration-150 data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0 motion-reduce:animate-none";

const popupClassName =
  "group/dialog-content fixed top-1/2 left-1/2 z-50 flex max-h-[calc(100dvh-2*var(--spacing-space-4))] w-[calc(100vw-2*var(--spacing-space-4))] max-w-lg -translate-x-1/2 -translate-y-1/2 flex-col gap-stack overflow-y-auto rounded-none border border-border bg-popover p-inset font-sans text-base text-popover-foreground shadow-lg duration-150 outline-none data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95 motion-reduce:animate-none sm:p-inset-lg";

const headerClassName = "flex shrink-0 flex-col gap-stack-sm";

const footerClassName =
  "-mx-inset -mb-inset flex shrink-0 flex-col-reverse gap-stack-sm border-t border-border px-inset py-inset sm:-mx-inset-lg sm:-mb-inset-lg sm:flex-row sm:justify-end sm:px-inset-lg";

const titleClassName =
  "font-heading text-xl font-semibold text-pretty text-foreground break-words hyphens-auto group-data-[close-button]/dialog-content:pr-space-6";

const descriptionClassName = "text-base text-muted-foreground";

const bodyClassName =
  "-mx-inset min-h-0 flex-1 overflow-y-auto px-inset sm:-mx-inset-lg sm:px-inset-lg";

function Dialog({ ...props }: DialogPrimitive.Root.Props) {
  return <DialogPrimitive.Root data-slot="dialog" {...props} />;
}

function DialogTrigger({ ...props }: DialogPrimitive.Trigger.Props) {
  return <DialogPrimitive.Trigger data-slot="dialog-trigger" {...props} />;
}

function DialogPortal({ ...props }: DialogPrimitive.Portal.Props) {
  return <DialogPrimitive.Portal data-slot="dialog-portal" {...props} />;
}

function DialogClose({ ...props }: DialogPrimitive.Close.Props) {
  return <DialogPrimitive.Close data-slot="dialog-close" {...props} />;
}

function DialogOverlay({
  className,
  ...props
}: DialogPrimitive.Backdrop.Props) {
  return (
    <DialogPrimitive.Backdrop
      data-slot="dialog-overlay"
      className={cn(overlayClassName, className)}
      {...props}
    />
  );
}

/**
 * The dialog popup. Focus trap, Esc to close and focus return to the trigger
 * come from Base UI; `initialFocus` (a ref) picks the first focused element.
 */
function DialogContent({
  className,
  children,
  showCloseButton = true,
  ...props
}: DialogPrimitive.Popup.Props & {
  showCloseButton?: boolean;
}) {
  return (
    <DialogPortal>
      <DialogOverlay />
      <DialogPrimitive.Popup
        data-slot="dialog-content"
        data-close-button={showCloseButton ? "" : undefined}
        className={cn(popupClassName, className)}
        {...props}
      >
        {children}
        {showCloseButton && (
          <DialogPrimitive.Close
            data-slot="dialog-close"
            render={
              <Button
                variant="secondary"
                size="icon"
                className="absolute top-space-2 right-space-2 rounded-none border-transparent sm:top-space-3 sm:right-space-3"
              />
            }
          >
            <XIcon aria-hidden />
            <span className="sr-only">Chiudi</span>
          </DialogPrimitive.Close>
        )}
      </DialogPrimitive.Popup>
    </DialogPortal>
  );
}

function DialogHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-header"
      className={cn(headerClassName, className)}
      {...props}
    />
  );
}

/**
 * Measures the scrolling body. It becomes a tab stop only while it overflows,
 * so keyboard users can scroll it (WCAG 2.1.1) without an extra stop
 * otherwise, and its content height feeds the body's minimum height.
 */
function useScrollMetrics(ref: React.RefObject<HTMLElement | null>) {
  const [metrics, setMetrics] = React.useState({
    scrollable: false,
    contentHeight: 0,
  });

  React.useLayoutEffect(() => {
    const node = ref.current;
    if (!node || typeof ResizeObserver === "undefined") return;
    const update = () =>
      setMetrics((prev) => {
        const next = {
          scrollable: node.scrollHeight > node.clientHeight,
          contentHeight: node.scrollHeight,
        };
        return prev.scrollable === next.scrollable &&
          prev.contentHeight === next.contentHeight
          ? prev
          : next;
      });
    update();
    const observer = new ResizeObserver(update);
    observer.observe(node);
    for (const child of Array.from(node.children)) observer.observe(child);
    return () => observer.disconnect();
  }, [ref]);

  return metrics;
}

/**
 * The only part of the dialog that scrolls. It never collapses below
 * `min(space-9, its content)`: when header and footer leave no room (200 %
 * text on a phone) the popup scrolls instead of hiding the body.
 */
function DialogBody({
  className,
  style,
  ref: forwardedRef,
  ...props
}: React.ComponentProps<"div">) {
  const ref = React.useRef<HTMLDivElement>(null);
  const { scrollable, contentHeight } = useScrollMetrics(ref);

  return (
    <div
      data-slot="dialog-body"
      ref={(node) => {
        ref.current = node;
        if (typeof forwardedRef === "function") forwardedRef(node);
        else if (forwardedRef) forwardedRef.current = node;
      }}
      tabIndex={scrollable ? 0 : undefined}
      style={{
        minHeight: contentHeight
          ? `min(var(--spacing-space-9), ${contentHeight}px)`
          : undefined,
        ...style,
      }}
      className={cn(
        bodyClassName,
        "focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring",
        className,
      )}
      {...props}
    />
  );
}

/** Always visible: it sits outside the scrolling body. */
function DialogFooter({
  className,
  showCloseButton = false,
  children,
  ...props
}: React.ComponentProps<"div"> & {
  showCloseButton?: boolean;
}) {
  return (
    <div
      data-slot="dialog-footer"
      className={cn(footerClassName, className)}
      {...props}
    >
      {children}
      {showCloseButton && (
        <DialogPrimitive.Close
          render={<Button variant="secondary" className="rounded-none" />}
        >
          Chiudi
        </DialogPrimitive.Close>
      )}
    </div>
  );
}

function DialogTitle({ className, ...props }: DialogPrimitive.Title.Props) {
  return (
    <DialogPrimitive.Title
      data-slot="dialog-title"
      className={cn(titleClassName, className)}
      {...props}
    />
  );
}

function DialogDescription({
  className,
  ...props
}: DialogPrimitive.Description.Props) {
  return (
    <DialogPrimitive.Description
      data-slot="dialog-description"
      className={cn(descriptionClassName, className)}
      {...props}
    />
  );
}

type DialogActionProps = React.ComponentProps<typeof Button> & {
  /** `destructive` paints the action with `color.error`. */
  tone?: "default" | "destructive";
  /** Disables the action, sets `aria-busy` and shows a spinner. */
  loading?: boolean;
  /** Label shown while `loading`, e.g. "Eliminazione…". */
  loadingText?: React.ReactNode;
};

/**
 * Confirm button for dialog footers. While `loading` it stays focusable
 * (`aria-disabled`), so keyboard focus is not lost to `<body>`.
 */
function DialogAction({
  tone = "default",
  loading = false,
  loadingText,
  disabled,
  className,
  children,
  ...props
}: DialogActionProps) {
  return (
    <Button
      data-slot="dialog-action"
      data-tone={tone}
      focusableWhenDisabled
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(
        "rounded-none",
        tone === "destructive" &&
          "bg-error-fg text-white hover:bg-error-fg/90 focus-visible:border-ring focus-visible:ring-ring/50",
        className,
      )}
      {...props}
    >
      {loading ? (
        <>
          <Loader2Icon
            data-icon="inline-start"
            aria-hidden
            className="animate-spin motion-reduce:animate-none"
          />
          {loadingText ?? children}
        </>
      ) : (
        children
      )}
    </Button>
  );
}

export {
  Dialog,
  DialogAction,
  DialogBody,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
  descriptionClassName as dialogDescriptionClassName,
  footerClassName as dialogFooterClassName,
  headerClassName as dialogHeaderClassName,
  overlayClassName as dialogOverlayClassName,
  popupClassName as dialogPopupClassName,
  titleClassName as dialogTitleClassName,
  type DialogActionProps,
};
