import { buildSignupSchema } from "./build-schema";
import { type FieldDescriptor } from "./fields";

export const DEFAULT_FORM_DESCRIPTORS: Array<FieldDescriptor> = [
  {
    type: "text",
    version: 1,
    data: {
      id: "name",
      label: "Name",
      required: true,
      scope: "per-attendee",
    },
  },
  {
    type: "email",
    version: 1,
    data: {
      id: "email",
      label: "Email",
      required: true,
      scope: "primary",
    },
  },
  {
    type: "phone",
    version: 1,
    data: {
      id: "phone",
      label: "Phone number",
      required: true,
      scope: "primary",
    },
  },
  {
    type: "checkbox",
    version: 1,
    data: {
      id: "alternate_menu",
      label: "Vegan / Vegetarian",
      required: false,
      scope: "per-attendee",
    },
  },
  {
    type: "checkbox",
    version: 1,
    data: {
      id: "studen",
      label: "Student",
      required: false,
      scope: "per-attendee",
    },
  },
  {
    type: "text",
    version: 1,
    data: {
      id: "diet_restrictions",
      label: "Dietary restrictions",
      required: false,
      scope: "per-attendee",
    },
  },
  {
    type: "textarea",
    version: 1,
    data: {
      id: "comment",
      label: "Comment",
      required: false,
      scope: "group",
    },
  },
];

export const DEFAULT_FORM_SCHEMA = buildSignupSchema(DEFAULT_FORM_DESCRIPTORS);
