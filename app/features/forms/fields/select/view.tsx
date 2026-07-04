import { getSelectProps, type FieldMetadata } from "@conform-to/react";
import type z from "zod";

import type { SelectFieldSchema } from "./model";

import { SelectField as BaseSelectField } from "~/components/forms";

type SelectFieldProps = {
  fieldConfig: z.infer<typeof SelectFieldSchema>;
  fieldMetadata: FieldMetadata<string>;
};

export function SelectField({
  fieldConfig: config,
  fieldMetadata: metadata,
}: SelectFieldProps) {
  return (
    <BaseSelectField
      labelProps={{ children: config.data.label }}
      selectProps={{
        ...getSelectProps(metadata),
        options: [
          // the empty option keeps "nothing chosen" representable — required
          // selects reject it, optional ones coerce it to undefined
          { label: "Select…", value: "" },
          ...config.data.options.map((option) => ({
            label: option,
            value: option,
          })),
        ],
      }}
      errors={metadata.errors}
    />
  );
}
