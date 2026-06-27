import z from "zod";
import { CheckboxFieldSchema } from "./checkbox/model";
import { CheckboxField } from "./checkbox/view";
import { EmailFieldSchema } from "./email/model";
import { EmailField } from "./email/view";
import { PhoneFieldSchema } from "./phone/model";
import { PhoneField } from "./phone/view";
import { TextFieldSchema } from "./text/model";
import { TextField } from "./text/view";
import { TextareaFieldSchema } from "./textarea/model";
import { TextareaField } from "./textarea/view";
import type { FieldType } from "./types";

const FieldDescriptorSchema = z.discriminatedUnion("type", [
  TextFieldSchema,
  TextareaFieldSchema,
  EmailFieldSchema,
  PhoneFieldSchema,
  CheckboxFieldSchema,
]);

export type FieldDescriptor = z.infer<typeof FieldDescriptorSchema>;

export const FormSchema = z.array(FieldDescriptorSchema).max(40);

const FieldViews: Record<FieldType, React.ElementType> = {
  text: TextField,
  email: EmailField,
  phone: PhoneField,
  textarea: TextareaField,
  checkbox: CheckboxField,
} as const;

export function getViewForField(descriptor: FieldDescriptor) {
  return FieldViews[descriptor.type];
}

export function getSchemaForField(descriptor: FieldDescriptor) {
  const { type, data } = descriptor;
  const { required } = data;

  switch (type) {
    case "text": {
      const schema = z.string().trim();
      if (required) return schema.min(1);
      return schema.optional();
    }

    case "textarea": {
      const schema = z.string().trim();
      if (required) return schema.min(1);
      return schema.optional();
    }

    case "email": {
      const schema = z.email().trim();
      if (required) return schema;
      return schema.optional();
    }

    case "phone": {
      const schema = z.string().trim();
      if (required) return schema.min(1);
      return schema.optional();
    }

    case "checkbox": {
      const schema = z.boolean().default(false);
      if (!required) return schema.optional();
      return schema.refine((data) => data === true, {
        error: `${data.label} is required`,
      });
    }

    default:
      asserNever(type);
  }
}

function asserNever(t: never): never {
  throw new Error(`Unhandled case for type: ${t}`);
}
