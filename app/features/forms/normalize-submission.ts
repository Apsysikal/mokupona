import type { FieldDescriptor, NonListFieldDescriptor } from "./fields";

// Conform's coercion strips unchecked optional checkboxes from the parse
// output entirely, and zod omits absent optional keys. Stored answers must
// carry explicit values instead: checkboxes always a boolean, lists always an
// array — so readers never have to guess what absence means.
export function normalizeSubmissionValues(
  descriptors: FieldDescriptor[],
  values: Record<string, unknown>,
): Record<string, unknown> {
  const normalized: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(values)) {
    if (value !== undefined) normalized[key] = value;
  }

  for (const descriptor of descriptors) {
    const name = descriptor.data.name;

    if (descriptor.type === "checkbox") {
      normalized[name] =
        typeof values[name] === "boolean" ? values[name] : false;
    } else if (descriptor.type === "list") {
      const items = Array.isArray(values[name])
        ? (values[name] as unknown[])
        : [];
      normalized[name] = items.map((item) =>
        normalizeItem(descriptor.data.itemFields, item),
      );
    }
  }

  return normalized;
}

function normalizeItem(
  itemFields: NonListFieldDescriptor[],
  item: unknown,
): Record<string, unknown> {
  const record: Record<string, unknown> = {};

  if (typeof item === "object" && item !== null && !Array.isArray(item)) {
    for (const [key, value] of Object.entries(item)) {
      if (value !== undefined) record[key] = value;
    }
  }

  for (const field of itemFields) {
    if (field.type === "checkbox") {
      const value = record[field.data.name];
      record[field.data.name] = typeof value === "boolean" ? value : false;
    }
  }

  return record;
}
