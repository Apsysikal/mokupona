import { FormSchema } from "./fields";

export function parseStoredFormSchema(value: unknown) {
  return FormSchema.safeParse(value);
}
