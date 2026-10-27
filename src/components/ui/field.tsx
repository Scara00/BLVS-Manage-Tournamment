"use client";

import { cn } from "cn";
import { AlertCircleIcon, Loader2Icon } from "lucide-react";
import {
  createContext,
  useContext,
  useId,
  type ComponentProps,
  type ReactNode,
} from "react";
import { mergeIds } from "@/lib/utils";

/**
 * Field system. One mechanism links every control to its label, hint, error
 * and loading text: `Field` / `Fieldset` provide a `FieldContext`, and each
 * control reads it through `useFieldControl()` (ids, aria-describedby,
 * aria-invalid, disabled, required, size). It works the same for native
 * <input>/<select> and for the Base UI checkbox and radio group.
 */

type FieldSize = "default" | "campo";

type FieldContextValue = {
  /** id for the control; `undefined` inside a Fieldset (many controls). */
  controlId?: string;
  describedBy?: string;
  invalid: boolean;
  disabled: boolean;
  required: boolean;
  loading: boolean;
  size: FieldSize;
};

const FieldContext = createContext<FieldContextValue | null>(null);

type FieldControlOwnProps = {
  id?: string;
  "aria-describedby"?: string;
  "aria-invalid"?: ComponentProps<"input">["aria-invalid"];
  disabled?: boolean;
  required?: boolean;
  size?: FieldSize;
};

/**
 * Merges the props a control received with what its Field provides. Props
 * passed explicitly win, except aria-describedby which is concatenated.
 */
function useFieldControl(own: FieldControlOwnProps) {
  const field = useContext(FieldContext);
  const invalid = own["aria-invalid"] ?? (field?.invalid || undefined);
  const loading = field?.loading ?? false;
  return {
    id: own.id ?? field?.controlId,
    "aria-describedby": mergeIds(own["aria-describedby"], field?.describedBy),
    "aria-invalid": invalid,
    "aria-busy": loading || undefined,
    disabled: own.disabled ?? (field?.disabled || loading ? true : undefined),
    required: own.required ?? (field?.required || undefined),
    size: own.size ?? field?.size ?? "default",
  };
}

/** Ids and aria-describedby for a block of hint / loading / error messages. */
function useFieldMessages({
  hint,
  error,
  loading,
}: {
  hint?: ReactNode;
  error?: ReactNode;
  loading?: boolean;
}) {
  const base = useId();
  const ids = {
    label: `${base}-label`,
    control: `${base}-control`,
    hint: `${base}-hint`,
    error: `${base}-error`,
    status: `${base}-status`,
  };
  // Error first: it is the most urgent thing to hear.
  const describedBy = mergeIds(
    error != null && error !== false && ids.error,
    hint != null && hint !== false && ids.hint,
    loading && ids.status,
  );
  return { ids, describedBy };
}

function RequiredMark() {
  return (
    <span className="font-sans font-normal text-muted-foreground">
      {" "}
      (obbligatorio)
    </span>
  );
}

const labelSize: Record<FieldSize, string> = {
  default: "text-base",
  campo: "text-lg",
};

function FieldLabel({
  className,
  required,
  size = "default",
  children,
  ...props
}: ComponentProps<"label"> & { required?: boolean; size?: FieldSize }) {
  return (
    <label
      data-slot="field-label"
      className={cn(
        "font-heading font-semibold text-foreground",
        labelSize[size],
        className,
      )}
      {...props}
    >
      {children}
      {required && <RequiredMark />}
    </label>
  );
}

function FieldHint({ className, ...props }: ComponentProps<"p">) {
  return (
    <p
      data-slot="field-hint"
      className={cn("text-sm text-muted-foreground", className)}
      {...props}
    />
  );
}

/** Error text: icon + "Errore:" prefix, so colour is never the only cue. */
function FieldError({ className, children, ...props }: ComponentProps<"p">) {
  return (
    <p
      data-slot="field-error"
      className={cn(
        "flex items-start gap-space-2 text-sm font-semibold text-error-fg",
        className,
      )}
      {...props}
    >
      <AlertCircleIcon aria-hidden className="mt-0.5 size-4 shrink-0" />
      <span>
        <span className="sr-only">Errore:</span> {children}
      </span>
    </p>
  );
}

/** Visible loading text, linked to the control through aria-describedby. */
function FieldStatus({
  className,
  children = "Caricamento…",
  ...props
}: ComponentProps<"p">) {
  return (
    <p
      data-slot="field-status"
      className={cn(
        "flex items-center gap-space-2 text-sm text-muted-foreground",
        className,
      )}
      {...props}
    >
      <Loader2Icon
        aria-hidden
        className="size-4 shrink-0 animate-spin motion-reduce:animate-none"
      />
      {children}
    </p>
  );
}

type FieldMessagesProps = {
  /** Help text shown under the label. */
  hint?: ReactNode;
  /** Error message; when present the control is `aria-invalid`. */
  error?: ReactNode;
  /** Adds a visible "(obbligatorio)" to the label and marks the control. */
  required?: boolean;
  disabled?: boolean;
  /** Disables the control, sets aria-busy and shows "Caricamento…". */
  loading?: boolean;
  /** `campo`: 48px controls and larger text, for courtside use. */
  size?: FieldSize;
};

type FieldProps = FieldMessagesProps & {
  label: ReactNode;
  /** id of the control; generated when omitted. */
  id?: string;
  className?: string;
  children: ReactNode;
};

/** A single control with its label, hint, error and loading text. */
function Field({
  label,
  hint,
  error,
  required = false,
  disabled = false,
  loading = false,
  size = "default",
  id,
  className,
  children,
}: FieldProps) {
  const { ids, describedBy } = useFieldMessages({ hint, error, loading });
  const controlId = id ?? ids.control;
  const invalid = error != null && error !== false;

  return (
    <FieldContext.Provider
      value={{
        controlId,
        describedBy,
        invalid,
        disabled,
        required,
        loading,
        size,
      }}
    >
      <div
        data-slot="field"
        data-invalid={invalid || undefined}
        className={cn("flex flex-col gap-space-2", className)}
      >
        <FieldLabel htmlFor={controlId} required={required} size={size}>
          {label}
        </FieldLabel>
        {hint != null && <FieldHint id={ids.hint}>{hint}</FieldHint>}
        {children}
        {loading && <FieldStatus id={ids.status} />}
        {invalid && <FieldError id={ids.error}>{error}</FieldError>}
      </div>
    </FieldContext.Provider>
  );
}

type FieldsetProps = FieldMessagesProps &
  Omit<ComponentProps<"fieldset">, "disabled"> & {
    legend: ReactNode;
  };

/**
 * A group of controls (e.g. checkboxes) under one visible legend. Hint and
 * error are linked to every control in the group.
 */
function Fieldset({
  legend,
  hint,
  error,
  required = false,
  disabled = false,
  loading = false,
  size = "default",
  className,
  children,
  ...props
}: FieldsetProps) {
  const { ids, describedBy } = useFieldMessages({ hint, error, loading });
  const invalid = error != null && error !== false;

  return (
    <FieldContext.Provider
      value={{ describedBy, invalid, disabled, required, loading, size }}
    >
      <fieldset
        data-slot="fieldset"
        data-invalid={invalid || undefined}
        aria-busy={loading || undefined}
        className={cn("m-0 flex min-w-0 flex-col gap-space-2 p-0", className)}
        {...props}
      >
        <legend
          className={cn(
            "mb-space-2 p-0 font-heading font-semibold text-foreground",
            labelSize[size],
          )}
        >
          {legend}
          {required && <RequiredMark />}
        </legend>
        {hint != null && <FieldHint id={ids.hint}>{hint}</FieldHint>}
        <div className="flex flex-col gap-space-2">{children}</div>
        {loading && <FieldStatus id={ids.status} />}
        {invalid && <FieldError id={ids.error}>{error}</FieldError>}
      </fieldset>
    </FieldContext.Provider>
  );
}

/**
 * Moves focus to the first control marked `aria-invalid="true"` inside
 * `root`, e.g. a form after a failed submit (client or server errors). A
 * radio group is not focusable itself, so focus goes to its checked radio,
 * or to the first enabled one. Call it after the errors have rendered.
 * Returns the focused element, or `null` when nothing is invalid.
 */
function focusFirstInvalid(root: ParentNode): HTMLElement | null {
  const invalid = root.querySelector<HTMLElement>('[aria-invalid="true"]');
  if (!invalid) return null;
  const target =
    invalid.getAttribute("role") === "radiogroup"
      ? (invalid.querySelector<HTMLElement>(
          '[role="radio"][aria-checked="true"]',
        ) ??
        invalid.querySelector<HTMLElement>(
          '[role="radio"]:not([aria-disabled="true"]):not([data-disabled])',
        ))
      : invalid;
  target?.focus();
  return target;
}

export {
  Field,
  FieldContext,
  FieldError,
  FieldHint,
  FieldLabel,
  Fieldset,
  FieldStatus,
  focusFirstInvalid,
  RequiredMark,
  useFieldControl,
  useFieldMessages,
  type FieldContextValue,
  type FieldMessagesProps,
  type FieldProps,
  type FieldsetProps,
  type FieldSize,
};
