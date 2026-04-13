import {
  getFormProps,
  getInputProps,
  getSelectProps,
  getTextareaProps,
  useForm,
} from "@conform-to/react";
import { getZodConstraint, parseWithZod } from "@conform-to/zod/v4";

import type { BlockEditorContext } from "../../catalog";

import {
  createTextSectionBlockEditorFormSchema,
  getTextSectionBlockEditorDefaultValue,
  getTextSectionBlockEditorFormId,
} from "./editor-schema";
import type { TextSectionBlockType } from "./model";

import { Field, SelectField, TextareaField } from "~/components/forms";
import { Button } from "~/components/ui/button";

type TextSectionBlockEditorProps = {
  ctx: BlockEditorContext<TextSectionBlockType["data"]>;
};

export function TextSectionBlockEditor({ ctx }: TextSectionBlockEditorProps) {
  const { data, blockRef, commandBuilder, capabilities, formState } = ctx;
  const schema = createTextSectionBlockEditorFormSchema();
  const formId = getTextSectionBlockEditorFormId(blockRef);
  const blockRefJson = JSON.stringify(blockRef);
  const baseCommand = commandBuilder.setBlockData(
    blockRef,
    "text-section",
    1,
    data,
  );
  const baseRevisionValue =
    baseCommand.baseRevision === null ? "" : String(baseCommand.baseRevision);

  const [form, fields] = useForm({
    id: formId,
    lastResult: formState?.lastResult ?? null,
    shouldValidate: "onBlur",
    constraint: getZodConstraint(schema),
    defaultValue: getTextSectionBlockEditorDefaultValue(data),
    onValidate({ formData }) {
      return parseWithZod(formData, { schema });
    },
  });

  return (
    <div className="flex flex-col gap-4 rounded-md border p-4">
      <form
        method="post"
        className="flex flex-col gap-4"
        {...getFormProps(form)}
      >
        <input type="hidden" name="intent" value="set-block-data" />
        <input type="hidden" name="blockRef" value={blockRefJson} />
        <input type="hidden" name="blockType" value="text-section" />
        <input type="hidden" name="blockVersion" value="1" />
        <input type="hidden" name="baseRevision" value={baseRevisionValue} />

        {formState?.errorMessage ? (
          <p className="text-destructive text-sm">{formState.errorMessage}</p>
        ) : null}

        {form.errors?.length ? (
          <p className="text-destructive text-sm">{form.errors.join(" ")}</p>
        ) : null}

        <Field
          labelProps={{ children: "Headline" }}
          inputProps={{ ...getInputProps(fields.headline, { type: "text" }) }}
          errors={fields.headline.errors}
          className="flex flex-col gap-2"
        />

        <TextareaField
          labelProps={{ children: "Body" }}
          textareaProps={{
            ...getTextareaProps(fields.body),
            rows: 5,
          }}
          errors={fields.body.errors}
          className="flex flex-col gap-2"
        />

        <SelectField
          labelProps={{ children: "Variant" }}
          selectProps={{
            ...getSelectProps(fields.variant),
            children: (
              <>
                <option value="plain">Plain</option>
                <option value="slanted">Slanted</option>
              </>
            ),
            className:
              "focus-visible:border-0 flex h-9 w-full appearance-none rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground file:placeholder:text-foreground focus-visible:outline-hidden focus-visible:inset-ring-2 focus-visible:inset-ring-ring disabled:cursor-not-allowed disabled:opacity-50",
          }}
          errors={fields.variant.errors}
          className="flex flex-col gap-2"
        />

        <Button type="submit" className="self-start">
          Save block
        </Button>
      </form>

      <div className="flex gap-2">
        {capabilities.canMoveUp ? (
          <form method="post">
            <input type="hidden" name="intent" value="move-block-up" />
            <input type="hidden" name="blockRef" value={blockRefJson} />
            <input
              type="hidden"
              name="baseRevision"
              value={baseRevisionValue}
            />
            <Button type="submit" variant="outline">
              Move up
            </Button>
          </form>
        ) : null}

        {capabilities.canMoveDown ? (
          <form method="post">
            <input type="hidden" name="intent" value="move-block-down" />
            <input type="hidden" name="blockRef" value={blockRefJson} />
            <input
              type="hidden"
              name="baseRevision"
              value={baseRevisionValue}
            />
            <Button type="submit" variant="outline">
              Move down
            </Button>
          </form>
        ) : null}

        {capabilities.canDelete ? (
          <form method="post">
            <input type="hidden" name="intent" value="delete-block" />
            <input type="hidden" name="blockRef" value={blockRefJson} />
            <input
              type="hidden"
              name="baseRevision"
              value={baseRevisionValue}
            />
            <Button
              type="submit"
              variant="outline"
              className="text-destructive"
            >
              Delete block
            </Button>
          </form>
        ) : null}
      </div>
    </div>
  );
}
