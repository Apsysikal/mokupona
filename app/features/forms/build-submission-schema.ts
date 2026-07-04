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
      shape[descriptor.data.name] = z
        .array(z.object(itemShape))
        .max(descriptor.data.maxCount);
    } else {
      shape[descriptor.data.name] = zodForField(descriptor);
    }
  }

  return z.object(shape);
}
