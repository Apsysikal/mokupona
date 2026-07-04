import z from "zod";

import { MAX_TOTAL_FIELDS } from "../bounds";

import { CheckboxFieldSchema } from "./checkbox/model";
import { EmailFieldSchema } from "./email/model";
import { ListFieldSchema } from "./list/model";
import { ListField } from "./list/view";
import {
  NonListFieldViews,
  type NonListFieldDescriptor,
} from "./non-list";
import { PhoneFieldSchema } from "./phone/model";
import { TextFieldSchema } from "./text/model";
import { TextareaFieldSchema } from "./textarea/model";
import type { FieldType } from "./types";

export {
  NonListFieldDescriptorSchema,
  zodForField,
  type NonListFieldDescriptor,
} from "./non-list";
export { ListFieldSchema } from "./list/model";

export const FieldDescriptorSchema = z.discriminatedUnion("type", [
  TextFieldSchema,
  TextareaFieldSchema,
  EmailFieldSchema,
  PhoneFieldSchema,
  CheckboxFieldSchema,
  ListFieldSchema,
]);

export type FieldDescriptor = z.infer<typeof FieldDescriptorSchema>;
export type ListFieldDescriptor = z.infer<typeof ListFieldSchema>;

export const FormSchema = z
  .array(FieldDescriptorSchema)
  .superRefine((fields, ctx) => {
    const totalFields = fields.reduce(
      (sum, field) =>
        sum + 1 + (field.type === "list" ? field.data.itemFields.length : 0),
      0,
    );
    if (totalFields > MAX_TOTAL_FIELDS) {
      ctx.addIssue({
        code: "custom",
        message: `A form can have at most ${MAX_TOTAL_FIELDS} fields in total`,
      });
    }

    // name uniqueness per scope: among top-level fields, and within each
    // list's itemFields
    checkUniqueNames(
      fields.map((field) => field.data.name),
      ctx,
      [],
    );
    fields.forEach((field, index) => {
      if (field.type !== "list") return;
      checkUniqueNames(
        field.data.itemFields.map((itemField) => itemField.data.name),
        ctx,
        [index, "data", "itemFields"],
      );
    });

    // the same name across scopes is the merge link, not a collision — but it
    // must carry the same field type everywhere it appears
    const typeByName = new Map<string, FieldType>();
    const checkConsistentType = (
      descriptor: FieldDescriptor | NonListFieldDescriptor,
      path: (string | number)[],
    ) => {
      const { name } = descriptor.data;
      const seenType = typeByName.get(name);
      if (seenType === undefined) {
        typeByName.set(name, descriptor.type);
      } else if (seenType !== descriptor.type) {
        ctx.addIssue({
          code: "custom",
          message: `Field "${name}" must have the same type everywhere it is used (found "${seenType}" and "${descriptor.type}")`,
          path,
        });
      }
    };
    fields.forEach((field, index) => {
      checkConsistentType(field, [index]);
      if (field.type !== "list") return;
      field.data.itemFields.forEach((itemField, itemIndex) => {
        checkConsistentType(itemField, [
          index,
          "data",
          "itemFields",
          itemIndex,
        ]);
      });
    });
  });

function checkUniqueNames(
  names: string[],
  ctx: z.RefinementCtx,
  basePath: (string | number)[],
) {
  const seen = new Set<string>();
  names.forEach((name, index) => {
    if (seen.has(name)) {
      ctx.addIssue({
        code: "custom",
        message: `Duplicate field name "${name}"`,
        path: [...basePath, index],
      });
    }
    seen.add(name);
  });
}

const FieldViews: Record<FieldType, React.ElementType> = {
  ...NonListFieldViews,
  list: ListField,
} as const;

export function getViewForField(descriptor: FieldDescriptor) {
  return FieldViews[descriptor.type];
}
