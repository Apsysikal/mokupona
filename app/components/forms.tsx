import React, { useId } from "react";

import { Checkbox } from "./ui/checkbox";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Textarea } from "./ui/textarea";

import { cn } from "~/lib/utils";

export type ListOfErrors = (string | null | undefined)[] | null | undefined;

// One dropzone treatment shared by every file-upload field (design system §9):
// a dashed hairline over the field fill that warms to the accent on hover.
// Pass it as a file Field's `inputProps.className`.
export const fileFieldClassName =
  "h-auto cursor-pointer rounded-lg border-dashed border-foreground/20 py-6 text-center transition-colors hover:border-primary/35 file:font-semibold";

export type FieldProps = {
  labelProps: React.ComponentProps<"label">;
  errors?: ListOfErrors;
  className?: string;
};

function useFieldIds(id: string | undefined, errors?: ListOfErrors) {
  const fallbackId = useId();
  const resolvedId = id ?? fallbackId;
  const errorId = errors?.length ? `${resolvedId}-error` : undefined;
  return { id: resolvedId, errorId };
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
        <li key={e} className="text-red-300 text-sm">
          {e}
        </li>
      ))}
    </ul>
  );
}

export function Field({
  labelProps,
  inputProps,
  errors,
  className,
}: FieldProps & {
  inputProps: React.InputHTMLAttributes<HTMLInputElement>;
}) {
  const { id, errorId } = useFieldIds(inputProps.id, errors);

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <Label htmlFor={id} {...labelProps} />
      <Input
        id={id}
        aria-invalid={errorId ? true : undefined}
        aria-describedby={errorId}
        {...inputProps}
      />
      {errorId ? <ErrorList id={errorId} errors={errors} /> : null}
    </div>
  );
}

export function TextareaField({
  labelProps,
  textareaProps,
  errors,
  className,
}: FieldProps & {
  textareaProps: React.TextareaHTMLAttributes<HTMLTextAreaElement>;
}) {
  const { id, errorId } = useFieldIds(textareaProps.id, errors);

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <Label htmlFor={id} {...labelProps} />
      <Textarea
        id={id}
        aria-invalid={errorId ? true : undefined}
        aria-describedby={errorId}
        {...textareaProps}
      />
      {errorId ? <ErrorList id={errorId} errors={errors} /> : null}
    </div>
  );
}

export function SelectField({
  labelProps,
  selectProps,
  errors,
  className,
}: FieldProps & {
  selectProps: React.SelectHTMLAttributes<HTMLSelectElement> & {
    options?: Array<{ label: string; value: string }>;
  };
}) {
  const { id, errorId } = useFieldIds(selectProps.id, errors);

  const {
    children,
    options,
    className: selectClassName,
    ...props
  } = selectProps;

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <Label htmlFor={id} {...labelProps} />
      <select
        id={id}
        aria-invalid={errorId ? true : undefined}
        aria-describedby={errorId}
        className={cn(
          "border-border bg-foreground/5 placeholder:text-foreground/40 file:placeholder:text-foreground focus-visible:inset-ring-ring flex h-11 w-full appearance-none rounded-lg border px-3 py-1 text-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium focus-visible:border-0 focus-visible:inset-ring-2 focus-visible:outline-hidden disabled:cursor-not-allowed disabled:opacity-50",
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
      {errorId ? <ErrorList id={errorId} errors={errors} /> : null}
    </div>
  );
}

export function CheckboxField({
  labelProps,
  buttonProps,
  errors,
  className,
}: FieldProps & {
  buttonProps: React.ComponentProps<"input"> & { name: string };
}) {
  const { id, errorId } = useFieldIds(buttonProps.id, errors);

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <div className="flex items-start gap-2">
        <Checkbox
          {...buttonProps}
          id={id}
          aria-invalid={errorId ? true : undefined}
          aria-describedby={errorId}
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
      {errorId ? <ErrorList id={errorId} errors={errors} /> : null}
    </div>
  );
}
