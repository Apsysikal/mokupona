import { useFormMetadata, type FieldMetadata } from "@conform-to/react";
import type z from "zod";

import { getViewForNonListField } from "../non-list";

import type { ListFieldSchema } from "./model";

import { ErrorList } from "~/components/forms";

type ListItem = Record<string, unknown>;

type ListFieldProps = {
  fieldConfig: z.infer<typeof ListFieldSchema>;
  fieldMetadata: FieldMetadata<ListItem[]>;
};

// Reads the form metadata from context so every field view shares the same
// {fieldConfig, fieldMetadata} contract; consumers must render fields inside
// Conform's <FormProvider context={form.context}>.
export function ListField({
  fieldConfig: config,
  fieldMetadata: metadata,
}: ListFieldProps) {
  const form = useFormMetadata();
  const { label, maxCount, addLabel, removeLabel, itemFields } = config.data;

  if (maxCount === 0) return null;

  const items = metadata.getFieldList();

  return (
    <>
      <div aria-hidden className="bg-foreground/12 my-1 h-px" />

      <div className="flex items-center justify-between">
        <span className="text-fg-muted text-[13px] lowercase">{label}</span>
        <span className="text-fg-faint text-xs">up to {maxCount}</span>
      </div>

      {items.length > 0 ? (
        <ul className="flex flex-col gap-3">
          {items.map((item, index) => {
            const itemFieldset = item.getFieldset();

            return (
              <li
                key={item.key}
                // sub-cards sit on the page surface; their inputs flip to the
                // raised surface so they stay distinguishable
                className="border-foreground/12 bg-background flex flex-col gap-3 rounded-[10px] border p-4 [--input-surface:var(--card)]"
              >
                <div className="flex items-center justify-between">
                  <span className="text-fg-label text-xs font-semibold tracking-[.16em] lowercase">
                    {label} {index + 1}
                  </span>
                  <button
                    {...form.remove.getButtonProps({
                      name: metadata.name,
                      index,
                    })}
                    className="text-primary text-xs lowercase hover:underline"
                  >
                    {removeLabel}
                  </button>
                </div>

                <fieldset className="flex w-full flex-col gap-3">
                  {itemFields.map((field) => {
                    const View = getViewForNonListField(field);

                    return (
                      <View
                        key={field.data.name}
                        fieldConfig={field}
                        fieldMetadata={itemFieldset[field.data.name]}
                      />
                    );
                  })}
                </fieldset>
              </li>
            );
          })}
        </ul>
      ) : null}

      {items.length < maxCount ? (
        <button
          {...form.insert.getButtonProps({ name: metadata.name })}
          className="text-primary flex w-fit items-center gap-1.5 text-[13px] font-medium lowercase hover:underline"
        >
          <span aria-hidden className="text-base leading-none">
            +
          </span>
          {addLabel}
        </button>
      ) : null}

      <ErrorList id={metadata.errorId} errors={metadata.errors} />
    </>
  );
}
