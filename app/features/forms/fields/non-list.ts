import z from "zod";

import { CheckboxFieldSchema } from "./checkbox/model";
import { CheckboxField } from "./checkbox/view";
import { EmailFieldSchema } from "./email/model";
import { EmailField } from "./email/view";
import { PhoneFieldSchema } from "./phone/model";
import { PhoneField } from "./phone/view";
import { SelectFieldSchema } from "./select/model";
import { SelectField } from "./select/view";
import { TextFieldSchema } from "./text/model";
import { TextField } from "./text/view";
import { TextareaFieldSchema } from "./textarea/model";
import { TextareaField } from "./textarea/view";

export const NonListFieldDescriptorSchema = z.discriminatedUnion("type", [
  TextFieldSchema,
  TextareaFieldSchema,
  EmailFieldSchema,
  PhoneFieldSchema,
  CheckboxFieldSchema,
  SelectFieldSchema,
]);

export type NonListFieldDescriptor = z.infer<
  typeof NonListFieldDescriptorSchema
>;
export type NonListFieldType = NonListFieldDescriptor["type"];

// The runtime list of non-list types (the union above is type-level only);
// the completeness check below fails to compile if the two ever drift.
export const NON_LIST_FIELD_TYPES = [
  "text",
  "textarea",
  "email",
  "phone",
  "checkbox",
  "select",
] as const satisfies readonly NonListFieldType[];

type AssertAllTypesListed =
  NonListFieldType extends (typeof NON_LIST_FIELD_TYPES)[number] ? true : never;
// becomes `never` (a compile error) when a union member is missing above.
export const NON_LIST_FIELD_TYPES_COMPLETE: AssertAllTypesListed = true;

// Constrains a view registry so each type maps to a view accepting exactly
// that type's descriptor — registering a view under the wrong key fails to
// compile. Views narrow the metadata's value type themselves, so it stays
// `any` here (FieldMetadata<any> would collapse its members to unknown).
export type ViewsFor<Descriptor extends { type: string }> = {
  [K in Descriptor["type"]]: (props: {
    fieldConfig: Extract<Descriptor, { type: K }>;
    fieldMetadata: any;
  }) => React.ReactNode;
};

export const NonListFieldViews = {
  text: TextField,
  email: EmailField,
  phone: PhoneField,
  textarea: TextareaField,
  checkbox: CheckboxField,
  select: SelectField,
} as const satisfies ViewsFor<NonListFieldDescriptor>;

// The registration above is type-checked; lookups are deliberately erased to
// React.ElementType because the config/metadata pair is only correlated at
// runtime.
export function getViewForNonListField(
  descriptor: NonListFieldDescriptor,
): React.ElementType {
  return NonListFieldViews[descriptor.type];
}

export function zodForField(descriptor: NonListFieldDescriptor) {
  const { label, required } = descriptor.data;

  const requiredError = `${label} is required`;

  // switch on descriptor.type (not a destructured copy) so each case narrows
  // the descriptor and can reach type-specific data like select options
  switch (descriptor.type) {
    case "text":
    case "textarea":
    case "phone": {
      const schema = z.string({ error: requiredError }).trim();
      if (required) return schema.min(1, { error: requiredError });
      return schema.optional();
    }

    case "email": {
      // trim first: a format schema's check runs before a chained .trim()
      const schema = z
        .string({ error: requiredError })
        .trim()
        .pipe(z.email({ error: `${label} is invalid` }));
      if (required) return schema;
      return schema.optional();
    }

    case "checkbox": {
      const schema = z.boolean().default(false);
      if (!required) return schema.optional();
      return schema.refine((value) => value === true, {
        error: `${label} is required`,
      });
    }

    case "select": {
      const { options } = descriptor.data;
      const schema = z
        .string({ error: requiredError })
        .refine((value) => options.includes(value), {
          error: `${label} is invalid`,
        });
      if (required) return schema;
      return schema.optional();
    }

    default:
      assertNever(descriptor);
  }
}

function assertNever(t: never): never {
  throw new Error(`Unhandled case for type: ${t}`);
}
