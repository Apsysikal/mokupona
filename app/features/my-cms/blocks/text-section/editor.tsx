import {
  getCollectionProps,
  getInputProps,
  getTextareaProps,
} from "@conform-to/react";
import type { EditorProps } from "./model";

import { Field, RadioField, TextareaField } from "~/components/forms";
import { schema } from "./model";

export function TextSectionBlockEditor({ fields, ...props }: EditorProps) {
  return (
    <div {...props}>
      <Field
        labelProps={{ children: "Headline" }}
        inputProps={{ ...getInputProps(fields.headline, { type: "text" }) }}
        errors={fields.headline.errors}
        className="flex flex-col gap-2"
      />
      <TextareaField
        labelProps={{ children: "Body" }}
        textareaProps={{ ...getTextareaProps(fields.body), rows: 5 }}
        errors={fields.body.errors}
        className="flex flex-col gap-2"
      />
      <RadioField
        labelProps={{ children: "Variant" }}
        inputProps={getCollectionProps(fields.variant, {
          type: "radio",
          options: [...schema.shape.variant.values],
        })}
        errors={fields.variant.errors}
      />
    </div>
  );
}
