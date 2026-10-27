"use client";

import * as React from "react";
import { AlertDialog as AlertDialogPrimitive } from "@base-ui/react/alert-dialog";
import { cn } from "cn";

import { Button } from "@/components/ui/button";
import {
  DialogAction,
  type DialogActionProps,
  DialogBody,
  dialogDescriptionClassName,
  dialogFooterClassName,
  dialogHeaderClassName,
  dialogOverlayClassName,
  dialogPopupClassName,
  dialogTitleClassName,
} from "@/components/ui/dialog";

/** Lets `AlertDialogCancel` register itself as the default initial focus. */
const CancelRefContext =
  React.createContext<React.RefObject<HTMLButtonElement | null> | null>(null);

function AlertDialog({ ...props }: AlertDialogPrimitive.Root.Props) {
  return <AlertDialogPrimitive.Root data-slot="alert-dialog" {...props} />;
}

function AlertDialogTrigger({ ...props }: AlertDialogPrimitive.Trigger.Props) {
  return (
    <AlertDialogPrimitive.Trigger data-slot="alert-dialog-trigger" {...props} />
  );
}

function AlertDialogPortal({ ...props }: AlertDialogPrimitive.Portal.Props) {
  return (
    <AlertDialogPrimitive.Portal data-slot="alert-dialog-portal" {...props} />
  );
}

function AlertDialogOverlay({
  className,
  ...props
}: AlertDialogPrimitive.Backdrop.Props) {
  return (
    <AlertDialogPrimitive.Backdrop
      data-slot="alert-dialog-overlay"
      className={cn(dialogOverlayClassName, className)}
      {...props}
    />
  );
}

/**
 * Esc closes it, a backdrop click does not (Base UI AlertDialog). Initial
 * focus defaults to `AlertDialogCancel`, the safe action; pass
 * `initialFocus` to override it.
 */
function AlertDialogContent({
  className,
  initialFocus,
  ...props
}: AlertDialogPrimitive.Popup.Props) {
  const cancelRef = React.useRef<HTMLButtonElement>(null);

  return (
    <CancelRefContext.Provider value={cancelRef}>
      <AlertDialogPortal>
        <AlertDialogOverlay />
        <AlertDialogPrimitive.Popup
          data-slot="alert-dialog-content"
          initialFocus={initialFocus ?? (() => cancelRef.current ?? true)}
          className={cn(dialogPopupClassName, "max-w-md", className)}
          {...props}
        />
      </AlertDialogPortal>
    </CancelRefContext.Provider>
  );
}

function AlertDialogHeader({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-dialog-header"
      className={cn(dialogHeaderClassName, className)}
      {...props}
    />
  );
}

function AlertDialogBody(props: React.ComponentProps<typeof DialogBody>) {
  return <DialogBody data-slot="alert-dialog-body" {...props} />;
}

function AlertDialogFooter({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-dialog-footer"
      className={cn(dialogFooterClassName, className)}
      {...props}
    />
  );
}

function AlertDialogTitle({
  className,
  ...props
}: AlertDialogPrimitive.Title.Props) {
  return (
    <AlertDialogPrimitive.Title
      data-slot="alert-dialog-title"
      className={cn(dialogTitleClassName, className)}
      {...props}
    />
  );
}

function AlertDialogDescription({
  className,
  ...props
}: AlertDialogPrimitive.Description.Props) {
  return (
    <AlertDialogPrimitive.Description
      data-slot="alert-dialog-description"
      className={cn(dialogDescriptionClassName, className)}
      {...props}
    />
  );
}

/** The confirm action: `tone="destructive"` and `loading` as in `DialogAction`. */
function AlertDialogAction(props: DialogActionProps) {
  return <DialogAction data-slot="alert-dialog-action" {...props} />;
}

/** The safe action: closes the dialog and receives focus on open. */
function AlertDialogCancel({
  className,
  variant = "outline",
  size = "default",
  ...props
}: AlertDialogPrimitive.Close.Props &
  Pick<React.ComponentProps<typeof Button>, "variant" | "size">) {
  const cancelRef = React.useContext(CancelRefContext);

  return (
    <AlertDialogPrimitive.Close
      data-slot="alert-dialog-cancel"
      ref={cancelRef}
      className={cn("rounded-none", className)}
      render={<Button variant={variant} size={size} />}
      {...props}
    />
  );
}

export {
  AlertDialog,
  AlertDialogAction,
  AlertDialogBody,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogOverlay,
  AlertDialogPortal,
  AlertDialogTitle,
  AlertDialogTrigger,
};
