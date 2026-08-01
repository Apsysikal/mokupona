import { ChevronDownIcon } from "@radix-ui/react-icons";
import React, { useId } from "react";

import { Checkbox } from "./ui/checkbox";
import { fieldShellClassName, Input } from "./ui/input";
import { Label } from "./ui/label";
import { Textarea } from "./ui/textarea";

import { cn } from "~/lib/utils";

export type ListOfErrors = (string | null | undefined)[] | null | undefined;

export const fileFieldClassName =
  "h-auto cursor-pointer rounded-lg border-dashed border-foreground/20 py-6 text-center transition-colors hover:border-primary/35 file:font-semibold";

export type FieldProps = {
  labelProps: React.ComponentProps<"label">;
  /** Optional helper text shown under the label and read out as the
   *  control's accessible description. */
  description?: string;
  errors?: ListOfErrors;
  className?: string;
};

function useFieldIds(
  id: string | undefined,
  errors?: ListOfErrors,
  description?: string,
) {
  const fallbackId = useId();
  const resolvedId = id ?? fallbackId;
  const errorId = errors?.length ? `${resolvedId}-error` : undefined;
  const descriptionId = description ? `${resolvedId}-description` : undefined;

  // Both describing nodes go into one attribute, in DOM order. An id is only
  // referenced when its node actually renders — a dangling IDREF is a real
  // a11y defect — and the trailing `|| undefined` keeps the attribute off the
  // element entirely rather than emitting aria-describedby="".
  const describedBy =
    [descriptionId, errorId].filter(Boolean).join(" ") || undefined;

  return { id: resolvedId, errorId, descriptionId, describedBy };
}

export function FieldDescription({
  id,
  children,
  className,
}: {
  id?: string;
  children?: React.ReactNode;
  className?: string;
}) {
  if (!children) return null;
  return (
    <p
      id={id}
      className={cn(
        "text-foreground/65 text-sm leading-snug whitespace-pre-line",
        className,
      )}
    >
      {children}
    </p>
  );
}

export function ErrorList({
  id,
  errors,
}: {
  id?: string;
  errors?: ListOfErrors;
}) {
  const errorsToRender = errors?.filter(Boolean);
  if (!errorsToRender?.length) return null;
  return (
    <ul id={id} className="flex flex-col gap-1">
      {errorsToRender.map((e) => (
        <li key={e} className="text-destructive-light text-sm">
          {e}
        </li>
      ))}
    </ul>
  );
}

export function Field({
  labelProps,
  inputProps,
  description,
  errors,
  className,
}: FieldProps & {
  inputProps: React.InputHTMLAttributes<HTMLInputElement>;
}) {
  const { id, errorId, descriptionId, describedBy } = useFieldIds(
    inputProps.id,
    errors,
    description,
  );

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <Label htmlFor={id} {...labelProps} />
      <FieldDescription id={descriptionId}>{description}</FieldDescription>
      <Input
        id={id}
        aria-invalid={errorId ? true : undefined}
        aria-describedby={describedBy}
        {...inputProps}
      />
      {errorId ? <ErrorList id={errorId} errors={errors} /> : null}
    </div>
  );
}

export function TextareaField({
  labelProps,
  textareaProps,
  description,
  errors,
  className,
}: FieldProps & {
  textareaProps: React.TextareaHTMLAttributes<HTMLTextAreaElement>;
}) {
  const { id, errorId, descriptionId, describedBy } = useFieldIds(
    textareaProps.id,
    errors,
    description,
  );

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <Label htmlFor={id} {...labelProps} />
      <FieldDescription id={descriptionId}>{description}</FieldDescription>
      <Textarea
        id={id}
        aria-invalid={errorId ? true : undefined}
        aria-describedby={describedBy}
        {...textareaProps}
      />
      {errorId ? <ErrorList id={errorId} errors={errors} /> : null}
    </div>
  );
}

export function SelectField({
  labelProps,
  selectProps,
  description,
  errors,
  className,
}: FieldProps & {
  selectProps: React.SelectHTMLAttributes<HTMLSelectElement> & {
    options?: Array<{ label: string; value: string }>;
  };
}) {
  const { id, errorId, descriptionId, describedBy } = useFieldIds(
    selectProps.id,
    errors,
    description,
  );

  const {
    children,
    options,
    className: selectClassName,
    ...props
  } = selectProps;

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <Label htmlFor={id} {...labelProps} />
      <FieldDescription id={descriptionId}>{description}</FieldDescription>
      <div className="relative">
        <select
          id={id}
          aria-invalid={errorId ? true : undefined}
          aria-describedby={describedBy}
          className={cn(
            fieldShellClassName,
            "focus-visible:inset-ring-ring flex w-full appearance-none py-1 pr-9 focus-visible:border-0 focus-visible:inset-ring-2 focus-visible:outline-hidden disabled:cursor-not-allowed disabled:opacity-50",
            selectClassName,
          )}
          {...props}
        >
          {options?.map(({ label, value }) => (
            <option key={value} value={value}>
              {label}
            </option>
          )) ?? children}
        </select>
        <ChevronDownIcon
          aria-hidden
          className="text-foreground/50 pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2"
        />
      </div>
      {errorId ? <ErrorList id={errorId} errors={errors} /> : null}
    </div>
  );
}

export function CheckboxField({
  labelProps,
  buttonProps,
  description,
  errors,
  className,
}: FieldProps & {
  buttonProps: React.ComponentProps<"input"> & { name: string };
}) {
  const { id, errorId, descriptionId, describedBy } = useFieldIds(
    buttonProps.id,
    errors,
    description,
  );

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <div className="flex items-center gap-2">
        <Checkbox
          {...buttonProps}
          id={id}
          aria-invalid={errorId ? true : undefined}
          aria-describedby={describedBy}
        />
        {/* checkbox labels read as body copy, not as field labels */}
        <Label
          htmlFor={id}
          {...labelProps}
          className={cn(
            "text-foreground/80 text-sm leading-snug font-normal",
            labelProps.className,
          )}
        />
      </div>
      {/* the checkbox and its label sit on one line, so the description goes
          beneath the pair, indented past the box to read as its continuation */}
      <FieldDescription id={descriptionId} className="pl-6">
        {description}
      </FieldDescription>
      {errorId ? <ErrorList id={errorId} errors={errors} /> : null}
    </div>
  );
}
