import { getInputProps, getSelectProps } from "@conform-to/react";
import { Field, SelectField } from "~/components/forms";
import { type EditorProps, editorSchema } from "./model";

export function ImageBlockEditor({ fields, ...props }: EditorProps) {
  return (
    <div {...props}>
      <SelectField
        labelProps={{ children: "Variant" }}
        selectProps={{
          ...getSelectProps(fields.variant),
          children: [...editorSchema.shape.variant.values].map((v) => {
            return <option value={v}>{v}</option>;
          }),
          className:
            "focus-visible:border-0 flex h-9 w-full appearance-none rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground file:placeholder:text-foreground focus-visible:outline-hidden focus-visible:inset-ring-2 focus-visible:inset-ring-ring disabled:cursor-not-allowed disabled:opacity-50",
        }}
        errors={fields.variant.errors}
      />

      <input {...getInputProps(fields.imageId, { type: "hidden" })} />

      <Field
        labelProps={{ children: "Image" }}
        inputProps={{
          ...getInputProps(fields.imageFile, { type: "file" }),
        }}
        errors={fields.imageFile.errors}
      />

      <Field
        labelProps={{ children: "Image alt text" }}
        inputProps={{
          ...getInputProps(fields.alt, { type: "text" }),
        }}
        errors={fields.alt.errors}
      />
    </div>
  );
}
