import { getInputProps, type FieldMetadata } from "@conform-to/react";
import type z from "zod";
import { Field } from "~/components/forms";
import { PhoneFieldSchema } from "./model";

type PhoneFieldProps = {
  fieldConfig: z.infer<typeof PhoneFieldSchema>;
  fieldMetadata: FieldMetadata<string>;
};

export function PhoneField({
  fieldConfig: config,
  fieldMetadata: metadata,
}: PhoneFieldProps) {
  return (
    <Field
      labelProps={{ children: config.data.label }}
      inputProps={{
        ...getInputProps(metadata, { type: "tel" }),
      }}
      errors={metadata.errors}
    />
  );
}
