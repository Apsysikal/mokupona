import { describe, expect, it } from "vitest";

import {
  INVITABLE_ROLE_OPTIONS,
  normalizeInvitableRole,
} from "./invite.shared";

describe("invitable role vocabulary", () => {
  it("preserves invitable roles and defaults all other values to user", () => {
    expect(normalizeInvitableRole("moderator")).toBe("moderator");
    expect(normalizeInvitableRole("admin")).toBe("user");
    expect(normalizeInvitableRole("unknown")).toBe("user");
  });

  it("provides the shared select options", () => {
    expect(INVITABLE_ROLE_OPTIONS).toEqual([
      { label: "User", value: "user" },
      { label: "Moderator", value: "moderator" },
    ]);
  });
});
