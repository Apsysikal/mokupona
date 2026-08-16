import { getInputProps, type FieldMetadata } from "@conform-to/react";

import { Field } from "~/components/forms";

export function makeInputFieldView<Descriptor extends InputFieldDescriptor>(
  inputType: "text" | "email" | "tel",
) {
  return function InputFieldView({
    fieldConfig: config,
    fieldMetadata: metadata,
  }: {
    fieldConfig: Descriptor;
    fieldMetadata: FieldMetadata<string>;
  }) {
    return (
      <Field
        labelProps={{ children: config.data.label }}
        description={config.data.description}
        inputProps={{
          ...getInputProps(metadata, { type: inputType }),
        }}
        errors={metadata.errors}
      />
    );
  };
}

interface InputFieldDescriptor {
  data: { label: string; description?: string };
}
