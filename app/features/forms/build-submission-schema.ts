import z from "zod";

import { zodForField, type FieldDescriptor } from "./fields";

export function buildSubmissionSchema(descriptors: Array<FieldDescriptor>) {
  const shape: Record<string, z.ZodType> = {};

  for (const descriptor of descriptors) {
    if (descriptor.type === "list") {
      const itemShape = Object.fromEntries(
        descriptor.data.itemFields.map((itemField) => [
          itemField.data.name,
          zodForField(itemField),
        ]),
      );
      const listSchema = z
        .array(z.object(itemShape))
        .max(descriptor.data.maxCount);
      // a required list must contain at least one item
      shape[descriptor.data.name] = descriptor.data.required
        ? listSchema.min(1)
        : listSchema;
    } else {
      shape[descriptor.data.name] = zodForField(descriptor);
    }
  }

  return z.object(shape);
}
