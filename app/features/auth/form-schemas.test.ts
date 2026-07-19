import { describe, expect, it } from "vitest";

import { displayNameSchema, emailSchema } from "./form-schemas";

describe("shared auth form schemas", () => {
  it("trims display names and rejects blank values", () => {
    expect(displayNameSchema.parse("  Ada  ")).toBe("Ada");
    expect(displayNameSchema.safeParse("   ").success).toBe(false);
  });

  it("accepts valid email addresses and rejects malformed ones", () => {
    expect(emailSchema.safeParse("ada@example.com").success).toBe(true);
    expect(emailSchema.safeParse("not-an-email").success).toBe(false);
  });
});
