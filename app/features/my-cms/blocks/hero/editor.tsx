import {
  getInputProps,
  getSelectProps,
  getTextareaProps,
  useFormMetadata,
} from "@conform-to/react";

import { editorSchema, type EditorProps } from "./model";

import { Field, SelectField, TextareaField } from "~/components/forms";
import { Button } from "~/components/ui/button";

export function HeroSectionBlockEditor({ fields, ...props }: EditorProps) {
  const form = useFormMetadata(fields.actions.formId);
  const actions = fields;

  return (
    <div {...props}>
      <Field
        labelProps={{ children: "Eyebrow" }}
        inputProps={{ ...getInputProps(fields.eyebrow, { type: "text" }) }}
        errors={fields.eyebrow.errors}
      />

      <Field
        labelProps={{ children: "Headline" }}
        inputProps={{ ...getInputProps(fields.headline, { type: "text" }) }}
        errors={fields.headline.errors}
      />

      <TextareaField
        labelProps={{ children: "Description" }}
        textareaProps={{ ...getTextareaProps(fields.description), rows: 5 }}
        errors={fields.description.errors}
      />

      <ul>
        {actions.map((action, index) => {
          const { label, href, variant } = action.getFieldset();

          return (
            <>
              <Field
                labelProps={{ children: "Label" }}
                inputProps={{ ...getInputProps(label, { type: "text" }) }}
                errors={label.errors}
              />

              <SelectField
                labelProps={{ children: "Link target" }}
                selectProps={{
                  ...getSelectProps(href),
                  options: [],
                }}
                errors={href.errors}
              />

              <SelectField
                labelProps={{ children: "Button variant" }}
                selectProps={{
                  ...getSelectProps(variant),
                  children: [
                    [
                      ...editorSchema.shape.actions.element.shape.variant
                        .unwrap()
                        .unwrap().values,
                    ].map((v) => {
                      return <option value={v}>{v}</option>;
                    }),
                  ],
                  className:
                    "focus-visible:border-0 flex h-9 w-full appearance-none rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground file:placeholder:text-foreground focus-visible:outline-hidden focus-visible:inset-ring-2 focus-visible:inset-ring-ring disabled:cursor-not-allowed disabled:opacity-50",
                }}
                errors={variant.errors}
              />

              <Button
                {...{
                  ...form.remove.getButtonProps({
                    name: fields.actions.name,
                    index,
                  }),
                  disabled: actions.length === 0,
                }}
                variant="destructive"
              >
                Remove this call to action
              </Button>
            </>
          );
        })}
      </ul>

      {actions.length < 2 ? (
        <Button
          variant="outline"
          {...form.insert.getButtonProps({ name: fields.actions.name })}
          className="mt-20"
        >
          Add a call to action
        </Button>
      ) : null}

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
