import { getInputProps, type FieldMetadata } from "@conform-to/react";
import type z from "zod";
import { Field } from "~/components/forms";
import { TextFieldSchema } from "./model";

type TextFieldProps = {
  fieldConfig: z.infer<typeof TextFieldSchema>;
  fieldMetadata: FieldMetadata<string>;
};

export function TextField({
  fieldConfig: config,
  fieldMetadata: metadata,
}: TextFieldProps) {
  return (
    <Field
      labelProps={{ children: config.data.label }}
      inputProps={{
        ...getInputProps(metadata, { type: "text" }),
      }}
      errors={metadata.errors}
    />
  );
}
