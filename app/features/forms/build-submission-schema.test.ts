import { describe, expect, it } from "vitest";

import { buildSubmissionSchema } from "./build-submission-schema";
import type { FieldDescriptor } from "./fields";

const FIELDS: Array<FieldDescriptor> = [
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
    type: "checkbox",
    version: 1,
    data: { name: "vegetarian", label: "Vegan / Vegetarian", required: false },
  },
  {
    type: "list",
    version: 1,
    data: {
      name: "friends",
      label: "Friends",
      required: false,
      maxCount: 2,
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
          data: { name: "vegetarian", label: "Vegetarian", required: false },
        },
      ],
    },
  },
];

describe("buildSubmissionSchema", () => {
  it("accepts a valid submission and applies defaults", () => {
    const schema = buildSubmissionSchema(FIELDS);
    const result = schema.parse({
      name: " Ada ",
      email: "ada@example.com",
      friends: [{ name: "Grace" }],
    });

    expect(result).toEqual({
      name: "Ada",
      email: "ada@example.com",
      vegetarian: false,
      friends: [{ name: "Grace", vegetarian: false }],
    });
  });

  it("rejects a missing required top-level field", () => {
    const schema = buildSubmissionSchema(FIELDS);
    const result = schema.safeParse({
      email: "ada@example.com",
      friends: [],
    });

    expect(result.success).toBe(false);
  });

  it("rejects a missing required field inside a list item", () => {
    const schema = buildSubmissionSchema(FIELDS);
    const result = schema.safeParse({
      name: "Ada",
      email: "ada@example.com",
      friends: [{ vegetarian: true }],
    });

    expect(result.success).toBe(false);
  });

  it("rejects more list items than maxCount", () => {
    const schema = buildSubmissionSchema(FIELDS);
    const result = schema.safeParse({
      name: "Ada",
      email: "ada@example.com",
      friends: [{ name: "1" }, { name: "2" }, { name: "3" }],
    });

    expect(result.success).toBe(false);
  });

  it("accepts only an empty list when maxCount is 0", () => {
    const disabledList = FIELDS.map((field) =>
      field.type === "list"
        ? { ...field, data: { ...field.data, maxCount: 0 } }
        : field,
    );
    const schema = buildSubmissionSchema(disabledList);

    expect(
      schema.safeParse({
        name: "Ada",
        email: "ada@example.com",
        friends: [],
      }).success,
    ).toBe(true);
    expect(
      schema.safeParse({
        name: "Ada",
        email: "ada@example.com",
        friends: [{ name: "Grace" }],
      }).success,
    ).toBe(false);
  });
});
