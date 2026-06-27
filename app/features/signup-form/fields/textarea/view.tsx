import { getTextareaProps, type FieldMetadata } from "@conform-to/react";
import type z from "zod";
import { TextareaField as BaseTextareaField } from "~/components/forms";
import { TextareaFieldSchema } from "./model";

type TextareaFieldProps = {
  fieldConfig: z.infer<typeof TextareaFieldSchema>;
  fieldMetadata: FieldMetadata<string>;
};

export function TextareaField({
  fieldConfig: config,
  fieldMetadata: metadata,
}: TextareaFieldProps) {
  return (
    <BaseTextareaField
      labelProps={{ children: config.data.label }}
      textareaProps={{
        ...getTextareaProps(metadata),
      }}
      errors={metadata.errors}
    />
  );
}
