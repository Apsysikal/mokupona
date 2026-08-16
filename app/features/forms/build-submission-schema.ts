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
      const { label, maxCount } = descriptor.data;
      const listSchema = z.array(z.object(itemShape)).max(maxCount, {
        error: `${label} can have at most ${maxCount} ${maxCount === 1 ? "entry" : "entries"}`,
      });
      shape[descriptor.data.name] = descriptor.data.required
        ? listSchema.min(1, { error: `${label} is required` })
        : listSchema;
    } else {
      shape[descriptor.data.name] = zodForField(descriptor);
    }
  }

  return z.object(shape);
}
