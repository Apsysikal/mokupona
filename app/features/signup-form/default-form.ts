import type { FieldDescriptor } from "~/features/forms/fields";

// Reproduces today's live form. Field names equal the legacy EventResponse
// column names, which makes the legacy merge in the read layer an identity
// mapping and unifies CSV columns across old and new data.
export const DEFAULT_FORM: Array<FieldDescriptor> = [
  {
    type: "text",
    version: 1,
    data: { name: "name", label: "Name", required: true },
  },
  {
    type: "email",
    version: 1,
    data: { name: "email", label: "Email", required: true },
  },
  {
    type: "phone",
    version: 1,
    data: { name: "phone", label: "Phone number", required: true },
  },
  {
    type: "checkbox",
    version: 1,
    data: { name: "vegetarian", label: "Vegan / Vegetarian", required: false },
  },
  {
    type: "checkbox",
    version: 1,
    data: { name: "student", label: "Student", required: false },
  },
  {
    type: "text",
    version: 1,
    data: {
      name: "restrictions",
      label: "Dietary restrictions",
      required: false,
    },
  },
  {
    type: "list",
    version: 1,
    data: {
      name: "friends",
      label: "Friends",
      required: false,
      maxCount: 3,
      addLabel: "Add a friend",
      removeLabel: "Remove this person",
      itemFields: [
        {
          type: "text",
          version: 1,
          data: { name: "name", label: "Name", required: true },
        },
        {
          type: "checkbox",
          version: 1,
          data: {
            name: "vegetarian",
            label: "Vegan / Vegetarian",
            required: false,
          },
        },
        {
          type: "checkbox",
          version: 1,
          data: { name: "student", label: "Student", required: false },
        },
        {
          type: "text",
          version: 1,
          data: {
            name: "restrictions",
            label: "Dietary restrictions",
            required: false,
          },
        },
      ],
    },
  },
  {
    type: "textarea",
    version: 1,
    data: { name: "comment", label: "Comment", required: false },
  },
];
