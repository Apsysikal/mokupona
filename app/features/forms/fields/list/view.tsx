import type { FieldMetadata, FormMetadata } from "@conform-to/react";
import type z from "zod";

import { getViewForNonListField } from "../non-list";

import type { ListFieldSchema } from "./model";

import { ErrorList } from "~/components/forms";
import { Button } from "~/components/ui/button";

type ListItem = Record<string, unknown>;

type ListFieldProps = {
  fieldConfig: z.infer<typeof ListFieldSchema>;
  fieldMetadata: FieldMetadata<ListItem[]>;
  formMetadata: FormMetadata;
};

export function ListField({
  fieldConfig: config,
  fieldMetadata: metadata,
  formMetadata: form,
}: ListFieldProps) {
  const { maxCount, addLabel, removeLabel, itemFields } = config.data;

  if (maxCount === 0) return null;

  const items = metadata.getFieldList();

  return (
    <>
      <ul className="flex flex-col gap-20">
        {items.map((item, index) => {
          const itemFieldset = item.getFieldset();

          return (
            <li key={item.id} className="flex gap-3">
              <fieldset className="flex w-full flex-col gap-4">
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

                <Button
                  {...form.remove.getButtonProps({
                    name: metadata.name,
                    index,
                  })}
                  variant="destructive"
                >
                  {removeLabel}
                </Button>
              </fieldset>
            </li>
          );
        })}
      </ul>

      {items.length < maxCount ? (
        <Button
          variant="outline"
          {...form.insert.getButtonProps({ name: metadata.name })}
        >
          {addLabel}
        </Button>
      ) : null}

      <ErrorList id={metadata.id} errors={metadata.errors} />
    </>
  );
}
