import { describe, expect, it } from "vitest";

import { DEFAULT_FORM } from "./default-form";
import { SignupFormSchema } from "./schema";

import type { FieldDescriptor } from "~/features/forms/fields";

describe("SignupFormSchema", () => {
  it("accepts DEFAULT_FORM", () => {
    expect(SignupFormSchema.safeParse(DEFAULT_FORM).success).toBe(true);
  });

  it("rejects a form without a friends list", () => {
    const withoutFriends = DEFAULT_FORM.filter(
      (field) => field.type !== "list",
    );

    expect(SignupFormSchema.safeParse(withoutFriends).success).toBe(false);
  });

  it("rejects a form whose list is not named friends", () => {
    const renamedList = DEFAULT_FORM.map((field) =>
      field.type === "list"
        ? { ...field, data: { ...field.data, name: "plus_ones" } }
        : field,
    );

    expect(SignupFormSchema.safeParse(renamedList).success).toBe(false);
  });

  it("rejects a second list", () => {
    const friends = DEFAULT_FORM.find((field) => field.type === "list");
    if (friends?.type !== "list") throw new Error("unreachable");
    const secondList: FieldDescriptor = {
      ...friends,
      data: { ...friends.data, name: "colleagues" },
    };

    expect(
      SignupFormSchema.safeParse([...DEFAULT_FORM, secondList]).success,
    ).toBe(false);
  });

  it.each(["name", "email", "phone"] as const)(
    "rejects a form without a top-level %s field",
    (name) => {
      const withoutField = DEFAULT_FORM.filter(
        (field) => field.type === "list" || field.data.name !== name,
      );

      expect(SignupFormSchema.safeParse(withoutField).success).toBe(false);
    },
  );

  it.each(["name", "email", "phone"] as const)(
    "rejects a form where %s is not required",
    (name) => {
      const notRequired = DEFAULT_FORM.map((field) =>
        field.type !== "list" && field.data.name === name
          ? { ...field, data: { ...field.data, required: false } }
          : field,
      );

      expect(SignupFormSchema.safeParse(notRequired).success).toBe(false);
    },
  );

  it("rejects a form where an identity field has the wrong type", () => {
    const emailAsCheckbox = DEFAULT_FORM.map((field) =>
      field.type === "email" ? { ...field, type: "checkbox" as const } : field,
    );

    expect(SignupFormSchema.safeParse(emailAsCheckbox).success).toBe(false);
  });

  it("still enforces the generic form bounds", () => {
    const duplicated = [...DEFAULT_FORM, DEFAULT_FORM[0]];

    expect(SignupFormSchema.safeParse(duplicated).success).toBe(false);
  });
});
