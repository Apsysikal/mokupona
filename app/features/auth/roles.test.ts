import { describe, expect, it } from "vitest";

import {
  isAdminRole,
  landingPathForRole,
  ROLE_FILTER_OPTIONS,
  roleLabel,
} from "./roles";

describe("role vocabulary helpers", () => {
  it("provides labels and filter options from the canonical vocabulary", () => {
    expect(roleLabel("admin")).toBe("administrator");
    expect(roleLabel("custom-role")).toBe("custom-role");
    expect(ROLE_FILTER_OPTIONS.map(({ value }) => value)).toEqual([
      "admin",
      "moderator",
      "user",
    ]);
  });

  it("distinguishes protected admins from admin-area roles", () => {
    expect(isAdminRole("admin")).toBe(true);
    expect(isAdminRole("moderator")).toBe(false);
    expect(landingPathForRole("admin")).toBe("/admin");
    expect(landingPathForRole("moderator")).toBe("/admin");
    expect(landingPathForRole("user")).toBe("/");
  });
});
