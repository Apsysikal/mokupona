import { getInputProps, type FieldMetadata } from "@conform-to/react";

import { Field } from "~/components/forms";

// The text, email, and phone views differ only in the rendered <input type>,
// so they all come from this factory — changes to how simple input fields
// render happen in one place.
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
