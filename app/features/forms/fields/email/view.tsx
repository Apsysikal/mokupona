import { getInputProps, type FieldMetadata } from "@conform-to/react";
import type z from "zod";

import type { EmailFieldSchema } from "./model";

import { Field } from "~/components/forms";

type EmailFieldProps = {
  fieldConfig: z.infer<typeof EmailFieldSchema>;
  fieldMetadata: FieldMetadata<string>;
};

export function EmailField({
  fieldConfig: config,
  fieldMetadata: metadata,
}: EmailFieldProps) {
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
