import {
  getFormProps,
  getInputProps,
  getSelectProps,
  useForm,
} from "@conform-to/react";
import { getZodConstraint, parseWithZod } from "@conform-to/zod/v4";

import type { BlockEditorContext } from "../../catalog";

import {
  createImageBlockEditorFormSchema,
  getImageBlockEditorDefaultValue,
  getImageBlockEditorFormId,
} from "./editor-schema";
import type { ImageBlockType } from "./model";

import { Field, SelectField } from "~/components/forms";
import { Button } from "~/components/ui/button";

type ImageBlockEditorProps = {
  ctx: BlockEditorContext<ImageBlockType["data"]>;
};

export function ImageBlockEditor({ ctx }: ImageBlockEditorProps) {
  const { data, blockRef, commandBuilder, capabilities, formState } = ctx;
  const schema = createImageBlockEditorFormSchema();
  const formId = getImageBlockEditorFormId(blockRef);
  const blockRefJson = JSON.stringify(blockRef);
  const baseCommand = commandBuilder.setBlockData(blockRef, "image", 1, data);
  const baseRevisionValue =
    baseCommand.baseRevision === null ? "" : String(baseCommand.baseRevision);

  const [form, fields] = useForm({
    id: formId,
    lastResult: formState?.lastResult ?? null,
    shouldValidate: "onBlur",
    constraint: getZodConstraint(schema),
    defaultValue: getImageBlockEditorDefaultValue(data),
    onValidate({ formData }) {
      return parseWithZod(formData, { schema });
    },
  });

  return (
    <div className="flex flex-col gap-4 rounded-md border p-4">
      <form
        method="post"
        encType="multipart/form-data"
        className="flex flex-col gap-4"
        {...getFormProps(form)}
      >
        <input type="hidden" name="intent" value="set-block-data" />
        <input type="hidden" name="blockRef" value={blockRefJson} />
        <input type="hidden" name="blockType" value="image" />
        <input type="hidden" name="blockVersion" value="1" />
        <input type="hidden" name="baseRevision" value={baseRevisionValue} />

        {formState?.errorMessage ? (
          <p className="text-destructive text-sm">{formState.errorMessage}</p>
        ) : null}

        {form.errors?.length ? (
          <p className="text-destructive text-sm">{form.errors.join(" ")}</p>
        ) : null}

        <p className="text-muted-foreground text-sm">
          {data.image.kind === "asset" ? (
            <>
              Image: <span>{data.image.src}</span> (default asset, read-only)
            </>
          ) : (
            <>
              Image: <span>{`/file/${data.image.imageId}`}</span> (CMS upload)
            </>
          )}
        </p>

        <SelectField
          labelProps={{ children: "Image action" }}
          selectProps={{
            ...getSelectProps(fields.imageAction),
            children: (
              <>
                <option value="keep">Keep current image</option>
                <option value="replace">Replace with uploaded image</option>
                {data.image.kind === "uploaded" ? (
                  <option value="remove">Use default asset image</option>
                ) : null}
              </>
            ),
            className:
              "focus-visible:border-0 flex h-9 w-full appearance-none rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground file:placeholder:text-foreground focus-visible:outline-hidden focus-visible:inset-ring-2 focus-visible:inset-ring-ring disabled:cursor-not-allowed disabled:opacity-50",
          }}
          errors={fields.imageAction.errors}
          className="flex flex-col gap-2"
        />

        <Field
          labelProps={{ children: "Upload image file" }}
          inputProps={{
            name: "imageFile",
            id: `${formId}-imageFile`,
            type: "file",
            accept: "image/*",
          }}
          errors={undefined}
          className="flex flex-col gap-2"
        />

        <SelectField
          labelProps={{ children: "Image accessibility" }}
          selectProps={{
            ...getSelectProps(fields.imageAccessibility),
            children: (
              <>
                <option value="">Choose accessibility</option>
                <option value="decorative">Decorative image</option>
                <option value="descriptive">Descriptive image</option>
              </>
            ),
            className:
              "focus-visible:border-0 flex h-9 w-full appearance-none rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground file:placeholder:text-foreground focus-visible:outline-hidden focus-visible:inset-ring-2 focus-visible:inset-ring-ring disabled:cursor-not-allowed disabled:opacity-50",
          }}
          errors={fields.imageAccessibility.errors}
          className="flex flex-col gap-2"
        />

        <Field
          labelProps={{ children: "Image alt text" }}
          inputProps={{ ...getInputProps(fields.imageAlt, { type: "text" }) }}
          errors={fields.imageAlt.errors}
          className="flex flex-col gap-2"
        />

        <SelectField
          labelProps={{ children: "Variant" }}
          selectProps={{
            ...getSelectProps(fields.variant),
            children: (
              <>
                <option value="default">Default</option>
                <option value="full-width">Full width</option>
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
