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
      <div className="relative">
        <select
          id={id}
          aria-invalid={errorId ? true : undefined}
          aria-describedby={errorId}
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
  errors,
  className,
}: FieldProps & {
  buttonProps: React.ComponentProps<"input"> & { name: string };
}) {
  const { id, errorId } = useFieldIds(buttonProps.id, errors);

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <div className="flex items-center gap-2">
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
