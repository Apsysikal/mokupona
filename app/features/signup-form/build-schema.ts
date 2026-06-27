import z from "zod";
import { getSchemaForField, type FieldDescriptor } from "./fields";
import type { FieldScope } from "./fields/types";

export function buildSignupSchema(descriptors: Array<FieldDescriptor>) {
  const primary = pickDescriptorSchemas("primary", descriptors);
  const perAttendee = pickDescriptorSchemas("per-attendee", descriptors);
  const group = pickDescriptorSchemas("group", descriptors);

  return z
    .object({
      signupPerson: z.object({ ...perAttendee, ...primary }),
      people: z.array(z.object({ ...perAttendee })).max(3),
      group: z.object({ ...group }),
      acceptPrivacy: z.boolean().default(false),
    })
    .refine((value) => value.acceptPrivacy === true, {
      path: ["acceptPrivacy"],
      error: "You must agree to register",
    });
}

function pickDescriptorSchemas(
  scope: FieldScope,
  descriptors: Array<FieldDescriptor>,
) {
  const result = descriptors
    .filter((d) => d.data.scope === scope)
    .map((d) => [d.data.id, getSchemaForField(d)] as const);

  return Object.fromEntries(result);
}
