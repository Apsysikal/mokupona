import { FormSchema } from "./fields";

// Validates a stored schema blob (e.g. a Prisma JsonValue, typed loosely)
// back into descriptors. A failure is a bug — every writer validates — so
// callers should log and degrade rather than render a wrong form.
export function parseStoredFormSchema(value: unknown) {
  return FormSchema.safeParse(value);
}
