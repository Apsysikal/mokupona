import { describe, expect, it } from "vitest";

import { MAX_TOTAL_FIELDS } from "../bounds";

import {
  FormSchema,
  type FieldDescriptor,
  type NonListFieldDescriptor,
} from "./index";

function textField(name: string): NonListFieldDescriptor {
  return {
    type: "text",
    version: 1,
    data: { name, label: `Label ${name}`, required: false },
  };
}

function checkboxField(name: string): NonListFieldDescriptor {
  return {
    type: "checkbox",
    version: 1,
    data: { name, label: `Label ${name}`, required: false },
  };
}

function listField(
  name: string,
  itemFields: Array<NonListFieldDescriptor>,
): FieldDescriptor {
  return {
    type: "list",
    version: 1,
    data: {
      name,
      label: `Label ${name}`,
      required: false,
      maxCount: 3,
      addLabel: "Add",
      removeLabel: "Remove",
      itemFields,
    },
  };
}

describe("FormSchema", () => {
  it("accepts a small valid form", () => {
    const result = FormSchema.safeParse([
      textField("title"),
      listField("entries", [textField("title")]),
    ]);

    expect(result.success).toBe(true);
  });

  it("counts fields recursively against MAX_TOTAL_FIELDS", () => {
    // 38 top-level + 1 list + 1 itemField = 40: exactly at the limit
    const atLimit = [
      ...Array.from({ length: MAX_TOTAL_FIELDS - 2 }, (_, i) =>
        textField(`field_${i}`),
      ),
      listField("entries", [textField("title")]),
    ];
    expect(FormSchema.safeParse(atLimit).success).toBe(true);

    // one more itemField pushes the recursive count over the limit
    const overLimit = [
      ...Array.from({ length: MAX_TOTAL_FIELDS - 2 }, (_, i) =>
        textField(`field_${i}`),
      ),
      listField("entries", [textField("title"), textField("extra")]),
    ];
    expect(FormSchema.safeParse(overLimit).success).toBe(false);
  });

  it("rejects duplicate names among top-level fields", () => {
    const result = FormSchema.safeParse([
      textField("title"),
      textField("title"),
    ]);

    expect(result.success).toBe(false);
  });

  it("rejects duplicate names within a list's itemFields", () => {
    const result = FormSchema.safeParse([
      listField("entries", [textField("title"), textField("title")]),
    ]);

    expect(result.success).toBe(false);
  });

  it("allows the same name across scopes when the type matches", () => {
    const result = FormSchema.safeParse([
      textField("title"),
      checkboxField("subscribed"),
      listField("entries", [textField("title"), checkboxField("subscribed")]),
    ]);

    expect(result.success).toBe(true);
  });

  it("rejects the same name across scopes with different types", () => {
    const result = FormSchema.safeParse([
      textField("subscribed"),
      listField("entries", [checkboxField("subscribed")]),
    ]);

    expect(result.success).toBe(false);
  });

  it("rejects a list nested inside a list at the schema level", () => {
    const nested = {
      type: "list",
      version: 1,
      data: {
        name: "entries",
        label: "Entries",
        required: false,
        maxCount: 3,
        addLabel: "Add",
        removeLabel: "Remove",
        itemFields: [listField("inner", [textField("title")])],
      },
    };

    expect(FormSchema.safeParse([nested]).success).toBe(false);
  });

  it("rejects a maxCount above MAX_LIST_COUNT", () => {
    const list = listField("entries", [textField("title")]);
    if (list.type !== "list") throw new Error("unreachable");
    list.data.maxCount = 11;

    expect(FormSchema.safeParse([list]).success).toBe(false);
  });

  it("rejects invalid field names", () => {
    expect(FormSchema.safeParse([textField("Invalid Name")]).success).toBe(
      false,
    );
    expect(
      FormSchema.safeParse([textField("1starts_with_digit")]).success,
    ).toBe(false);
  });
});
