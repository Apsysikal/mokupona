import { describe, expect, it } from "vitest";

import { zodForField, type NonListFieldDescriptor } from "./non-list";

function descriptor(
  type: NonListFieldDescriptor["type"],
  required: boolean,
): NonListFieldDescriptor {
  return {
    type,
    version: 1,
    data: { name: "field", label: "Field", required },
  };
}

describe("zodForField", () => {
  describe.each(["text", "textarea", "phone"] as const)("%s", (type) => {
    it("trims and accepts a value", () => {
      const schema = zodForField(descriptor(type, true));
      expect(schema.parse("  hello  ")).toBe("hello");
    });

    it("rejects an empty value when required", () => {
      const schema = zodForField(descriptor(type, true));
      expect(schema.safeParse("   ").success).toBe(false);
      expect(schema.safeParse("").success).toBe(false);
      expect(schema.safeParse(undefined).success).toBe(false);
    });

    it("accepts a missing value when optional", () => {
      const schema = zodForField(descriptor(type, false));
      expect(schema.parse(undefined)).toBeUndefined();
    });
  });

  describe("email", () => {
    it("accepts a valid email", () => {
      const schema = zodForField(descriptor("email", true));
      expect(schema.parse("a@example.com")).toBe("a@example.com");
    });

    it("trims before validating", () => {
      const schema = zodForField(descriptor("email", true));
      expect(schema.parse(" a@example.com ")).toBe("a@example.com");
    });

    it("rejects an invalid email", () => {
      const schema = zodForField(descriptor("email", true));
      expect(schema.safeParse("not-an-email").success).toBe(false);
    });

    it("rejects a missing value when required", () => {
      const schema = zodForField(descriptor("email", true));
      expect(schema.safeParse(undefined).success).toBe(false);
    });

    it("accepts a missing value when optional", () => {
      const schema = zodForField(descriptor("email", false));
      expect(schema.parse(undefined)).toBeUndefined();
    });
  });

  describe("checkbox", () => {
    it("defaults to false when optional and missing", () => {
      const schema = zodForField(descriptor("checkbox", false));
      expect(schema.parse(undefined)).toBe(false);
    });

    it("accepts true and false when optional", () => {
      const schema = zodForField(descriptor("checkbox", false));
      expect(schema.parse(true)).toBe(true);
      expect(schema.parse(false)).toBe(false);
    });

    it("must be checked when required", () => {
      const schema = zodForField(descriptor("checkbox", true));
      expect(schema.parse(true)).toBe(true);
      expect(schema.safeParse(false).success).toBe(false);
      expect(schema.safeParse(undefined).success).toBe(false);
    });
  });
});
