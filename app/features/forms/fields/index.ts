import z from "zod";

import { MAX_TOTAL_FIELDS } from "../bounds";

import { ListFieldSchema } from "./list/model";
import { ListField } from "./list/view";
import {
  NonListFieldDescriptorSchema,
  NonListFieldViews,
  type NonListFieldDescriptor,
  type ViewsFor,
} from "./non-list";

export { zodForField, type NonListFieldDescriptor } from "./non-list";

const FieldDescriptorSchema = z.discriminatedUnion("type", [
  ...NonListFieldDescriptorSchema.options,
  ListFieldSchema,
]);

export type FieldDescriptor = z.infer<typeof FieldDescriptorSchema>;
type FieldType = FieldDescriptor["type"];

interface PlacedDescriptor {
  descriptor: FieldDescriptor | NonListFieldDescriptor;
  path: (string | number)[];
}

function flattenIntoScopes(fields: FieldDescriptor[]): PlacedDescriptor[][] {
  const topLevel = fields.map((descriptor, index) => ({
    descriptor,
    path: [index],
  }));

  const listScopes = fields.flatMap((field, index) =>
    field.type === "list"
      ? [
          field.data.itemFields.map((descriptor, itemIndex) => ({
            descriptor,
            path: [index, "data", "itemFields", itemIndex],
          })),
        ]
      : [],
  );

  return [topLevel, ...listScopes];
}

export const FormSchema = z
  .array(FieldDescriptorSchema)
  .superRefine((fields, ctx) => {
    const scopes = flattenIntoScopes(fields);
    const allPlaced = scopes.flat();

    if (allPlaced.length > MAX_TOTAL_FIELDS) {
      ctx.addIssue({
        code: "custom",
        message: `A form can have at most ${MAX_TOTAL_FIELDS} fields in total`,
      });
    }

    for (const scope of scopes) {
      const seen = new Set<string>();
      for (const { descriptor, path } of scope) {
        if (seen.has(descriptor.data.name)) {
          ctx.addIssue({
            code: "custom",
            message: `Duplicate field name "${descriptor.data.name}"`,
            path,
          });
        }
        seen.add(descriptor.data.name);
      }
    }

    const typeByName = new Map<string, FieldType>();
    for (const { descriptor, path } of allPlaced) {
      const seenType = typeByName.get(descriptor.data.name);
      if (seenType === undefined) {
        typeByName.set(descriptor.data.name, descriptor.type);
      } else if (seenType !== descriptor.type) {
        ctx.addIssue({
          code: "custom",
          message: `Field "${descriptor.data.name}" must have the same type everywhere it is used (found "${seenType}" and "${descriptor.type}")`,
          path,
        });
      }
    }
  });

const FieldViews = {
  ...NonListFieldViews,
  list: ListField,
} as const satisfies ViewsFor<FieldDescriptor>;

export function getViewForField(
  descriptor: FieldDescriptor,
): React.ElementType {
  return FieldViews[descriptor.type];
}
