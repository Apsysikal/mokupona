import { getInputProps, type FieldMetadata } from "@conform-to/react";
import type z from "zod";

import type { CheckboxFieldSchema } from "./model";

import { CheckboxField as BaseCheckboxField } from "~/components/forms";

type CheckboxFieldProps = {
  fieldConfig: z.infer<typeof CheckboxFieldSchema>;
  fieldMetadata: FieldMetadata<boolean>;
};

export function CheckboxField({
  fieldConfig: config,
  fieldMetadata: metadata,
}: CheckboxFieldProps) {
  return (
    <BaseCheckboxField
      labelProps={{ children: config.data.label }}
      description={config.data.description}
      buttonProps={{
        ...getInputProps(metadata, { type: "checkbox" }),
      }}
      errors={metadata.errors}
    />
  );
}
