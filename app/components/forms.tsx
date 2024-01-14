import React from "react";

import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Textarea } from "./ui/textarea";

export function Field({
  labelProps,
  inputProps,
  errors,
  className,
}: {
  labelProps: React.InputHTMLAttributes<HTMLLabelElement>;
  inputProps: React.InputHTMLAttributes<HTMLInputElement>;
  errors?: string;
  className?: string;
}) {
  const { id, ...props } = inputProps;
  const errorId = `error-${id}`;

  return (
    <div className={className}>
      <Label htmlFor={id} {...labelProps} />
      <Input
        id={id}
        aria-invalid={errors ? true : undefined}
        aria-describedby={errorId}
        {...props}
      />
      {errors ? (
        <p id={errorId} className="text-sm text-destructive">
          {errors}
        </p>
      ) : null}
    </div>
  );
}

export function TextareaField({
  labelProps,
  textareaProps,
  errors,
  className,
}: {
  labelProps: React.InputHTMLAttributes<HTMLLabelElement>;
  textareaProps: React.InputHTMLAttributes<HTMLTextAreaElement>;
  errors?: string;
  className?: string;
}) {
  const { id, ...props } = textareaProps;
  const errorId = `error-${id}`;

  return (
    <div className={className}>
      <Label htmlFor={id} {...labelProps} />
      <Textarea
        id={id}
        aria-invalid={errors ? true : undefined}
        aria-describedby={errorId}
        {...props}
      />
      {errors ? (
        <p id={errorId} className="text-sm text-destructive">
          {errors}
        </p>
      ) : null}
    </div>
  );
}

export function SelectField({
  labelProps,
  selectProps,
  errors,
  className,
}: {
  labelProps: React.InputHTMLAttributes<HTMLLabelElement>;
  selectProps: React.InputHTMLAttributes<HTMLSelectElement>;
  errors?: string;
  className?: string;
}) {
  const { id, children, ...props } = selectProps;
  const errorId = `error-${id}`;

  return (
    <div className={className}>
      <Label htmlFor={id} {...labelProps} />
      <select
        id={id}
        aria-invalid={errors ? true : undefined}
        aria-describedby={errorId}
        {...props}
      >
        {children}
      </select>
      {errors ? (
        <p id={errorId} className="text-sm text-destructive">
          {errors}
        </p>
      ) : null}
    </div>
  );
}
