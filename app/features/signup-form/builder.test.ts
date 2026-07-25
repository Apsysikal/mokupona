import { describe, expect, it } from "vitest";

import {
  builderRowsToDescriptors,
  defaultBuilderRows,
  descriptorsToBuilderRows,
  SignupFormBuilderSchema,
  slugifyFieldKey,
} from "./builder";
import { DEFAULT_FORM } from "./default-form";

describe("builder row transforms", () => {
  it("round-trips DEFAULT_FORM exactly (deep-equal skip must keep working)", () => {
    const rows = descriptorsToBuilderRows(DEFAULT_FORM);

    expect(builderRowsToDescriptors(rows)).toEqual(DEFAULT_FORM);
  });

  it("round-trips a select field's one-per-line options", () => {
    const rows = [
      ...defaultBuilderRows(),
      {
        type: "select" as const,
        name: "menu",
        label: "Menu choice",
        required: true,
        options: "Meat\nVegan",
      },
    ];

    const descriptors = builderRowsToDescriptors(rows);

    expect(descriptors.at(-1)).toEqual({
      type: "select",
      version: 1,
      data: {
        name: "menu",
        label: "Menu choice",
        required: true,
        options: ["Meat", "Vegan"],
      },
    });
    expect(descriptorsToBuilderRows(descriptors)).toEqual(rows);
    expect(SignupFormBuilderSchema.safeParse(rows).success).toBe(true);
  });

  it("rejects duplicate select options, anchored on the options field", () => {
    const rows = [
      ...defaultBuilderRows(),
      {
        type: "select" as const,
        name: "menu",
        label: "Menu choice",
        required: false,
        options: "Meat\nMeat ",
      },
    ];

    const result = SignupFormBuilderSchema.safeParse(rows);

    expect(result.success).toBe(false);
    const issue = result.error?.issues.find((candidate) =>
      candidate.message.includes("unique"),
    );
    expect(issue?.path).toEqual([rows.length - 1, "options"]);
  });

  it("rejects a select field without options, with the issue on the row", () => {
    const rows = [
      ...defaultBuilderRows(),
      {
        type: "select" as const,
        name: "menu",
        label: "Menu choice",
        required: false,
        options: "",
      },
    ];

    const result = SignupFormBuilderSchema.safeParse(rows);

    expect(result.success).toBe(false);
    const issue = result.error?.issues.find((candidate) =>
      candidate.message.includes("at least one option"),
    );
    expect(issue?.path).toEqual([rows.length - 1, "options"]);
  });

  it("maps custom rows to versioned descriptors", () => {
    const descriptors = builderRowsToDescriptors([
      { type: "checkbox", name: "newsletter", label: "News?", required: true },
    ]);

    expect(descriptors).toEqual([
      {
        type: "checkbox",
        version: 1,
        data: { name: "newsletter", label: "News?", required: true },
      },
    ]);
  });
});

describe("SignupFormBuilderSchema", () => {
  it("accepts the default rows", () => {
    const result = SignupFormBuilderSchema.safeParse(defaultBuilderRows());

    expect(result.success).toBe(true);
  });

  it("rejects duplicate field keys with the issue on the row", () => {
    const rows = defaultBuilderRows();
    rows.push({
      type: "text",
      name: "email",
      label: "Second email",
      required: false,
    });

    const result = SignupFormBuilderSchema.safeParse(rows);

    expect(result.success).toBe(false);
    const issue = result.error?.issues.find((candidate) =>
      candidate.message.includes("Duplicate"),
    );
    expect(issue?.path).toEqual([rows.length - 1]);
  });

  it("rejects removing the pinned identity fields", () => {
    const rows = defaultBuilderRows().filter((row) => row.name !== "email");

    const result = SignupFormBuilderSchema.safeParse(rows);

    expect(result.success).toBe(false);
  });

  it("rejects a missing friend count instead of silently disabling friends", () => {
    const rows = defaultBuilderRows().map((row) =>
      row.type === "list" ? { ...row, maxCount: undefined } : row,
    );

    const result = SignupFormBuilderSchema.safeParse(rows);

    expect(result.success).toBe(false);
    const issue = result.error?.issues.find((candidate) =>
      candidate.message.includes("Friend count is required"),
    );
    expect(issue?.path?.at(-1)).toBe("maxCount");
  });

  it("rejects a friends count above the profile ceiling", () => {
    const rows = defaultBuilderRows().map((row) =>
      row.type === "list" ? { ...row, maxCount: 11 } : row,
    );

    const result = SignupFormBuilderSchema.safeParse(rows);

    expect(result.success).toBe(false);
  });
});

describe("slugifyFieldKey", () => {
  it.each([
    ["Dietary restrictions", "dietary_restrictions"],
    ["  T-Shirt size!  ", "t_shirt_size"],
    ["2nd choice", "nd_choice"],
    ["🎉🎉", "field"],
  ])("derives %j -> %j", (label, expected) => {
    expect(slugifyFieldKey(label)).toBe(expected);
  });
});
