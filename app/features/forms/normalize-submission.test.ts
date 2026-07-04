import { describe, expect, it } from "vitest";

import { normalizeSubmissionValues } from "./normalize-submission";

import { DEFAULT_FORM } from "~/features/signup-form/default-form";

describe("normalizeSubmissionValues", () => {
  it("stores explicit false for absent checkboxes, top-level and per item", () => {
    const normalized = normalizeSubmissionValues(DEFAULT_FORM, {
      name: "Ada",
      email: "ada@example.com",
      phone: "1",
      student: true,
      friends: [{ name: "Grace" }],
    });

    expect(normalized).toMatchObject({
      vegetarian: false,
      student: true,
      friends: [{ name: "Grace", vegetarian: false, student: false }],
    });
  });

  it("stores an empty array for an absent list", () => {
    const normalized = normalizeSubmissionValues(DEFAULT_FORM, {
      name: "Ada",
      email: "ada@example.com",
      phone: "1",
    });

    expect(normalized.friends).toEqual([]);
  });

  it("drops undefined values instead of persisting them", () => {
    const normalized = normalizeSubmissionValues(DEFAULT_FORM, {
      name: "Ada",
      email: "ada@example.com",
      phone: "1",
      restrictions: undefined,
      friends: [],
    });

    expect("restrictions" in normalized).toBe(false);
  });

  it("keeps present values untouched", () => {
    const normalized = normalizeSubmissionValues(DEFAULT_FORM, {
      name: "Ada",
      email: "ada@example.com",
      phone: "1",
      vegetarian: true,
      restrictions: "nuts",
      comment: "hi",
      friends: [{ name: "Grace", vegetarian: true, restrictions: "none" }],
    });

    expect(normalized).toMatchObject({
      vegetarian: true,
      restrictions: "nuts",
      comment: "hi",
      friends: [{ name: "Grace", vegetarian: true, restrictions: "none" }],
    });
  });
});
